/**
 * Unit tests for the shared notability-basis resync rule. No database: `planNotabilityBasisResync`
 * is pure, and a fake client records the `UPDATE`s `applyNotabilityBasisResync` issues.
 *
 * Each test is named for the live record whose shape it encodes, so a future change that breaks
 * one says which record it broke. The two that matter most are the Tubman case (a curated sentence
 * survives) and the repo-z1uk case (a curated criterion with no evidence survives) — those are the
 * anti-regressions for the 47 records a strict recompute would strip.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReleaseClaimProjection } from '@repo/domain';
import {
  applyNotabilityBasisResync,
  encodeBasis,
  notabilityBasisIsConverged,
  notabilityLabelsForBasis,
  notesAreSameSentence,
  planNotabilityBasisResync,
  type NotabilityBasisResyncClient,
  type NotabilityBasisResyncRow,
} from './notability-basis-resync.ts';

function claim(over: Partial<ReleaseClaimProjection> & { id: string }): ReleaseClaimProjection {
  return {
    predicate: 'led',
    object: 'something',
    confidenceLevel: 'high',
    citationSource: 'example.org',
    citationLabel: 'Example',
    ...over,
  };
}

function row(over: Partial<NotabilityBasisResyncRow>): NotabilityBasisResyncRow {
  return {
    entityId: 'ent_test',
    kind: 'person',
    displayName: 'Test Person',
    summary: 'A summary.',
    claims: [],
    publishedBasis: [],
    publishedLabels: [],
    hasTaxonomyLabels: false,
    hasSearchIndex: true,
    ...over,
  };
}

function fakeClient() {
  const updates: Array<{ sql: string; params: readonly unknown[] }> = [];
  const client: NotabilityBasisResyncClient & { readonly updates: typeof updates } = {
    updates,
    query: async <T extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[],
    ): Promise<{ readonly rows: T[]; readonly rowCount?: number | null }> => {
      updates.push({ sql, params: params ?? [] });
      return { rows: [], rowCount: 1 };
    },
  };
  return client;
}

/* (a) S1 — the eula-johnson shape. */
test('a basis record whose evidenceId is absent from the claims is replaced by the rebuild', () => {
  const subject = row({
    entityId: 'civil-rights-leaders-eula-johnson',
    displayName: 'Eula Johnson',
    claims: [
      claim({
        id: 'claim_civil_rights_leaders_eula_johnson_01',
        predicate: 'led_naacp_branch',
        object: 'Johnson was the first woman president of the Broward chapter of the NAACP.',
      }),
    ],
    publishedBasis: [
      {
        criterion: 'first_to_do_x',
        note: "Documented site NAACP Fort Lauderdale/Broward Branch's first woman president.",
        // The hyphenated id the record no longer carries: the whole defect, in one field.
        evidenceIds: ['claim_civil-rights-leaders-eula-johnson_01'],
      },
    ],
  });

  const plan = planNotabilityBasisResync([subject]);
  assert.equal(plan.changes.length, 1);
  const change = plan.changes[0];
  assert.equal(change?.droppedDangling.length, 1);
  assert.equal(change?.droppedDangling[0]?.criterion, 'first_to_do_x');
  // The criterion is re-stated from the record's own claims, never simply removed.
  assert.ok(change?.basisAfter.some((record) => record.criterion === 'first_to_do_x'));
  assert.deepEqual(change?.basisAfter[0]?.evidenceIds, [
    'claim_civil_rights_leaders_eula_johnson_01',
  ]);
  assert.ok(!change?.basisAfter[0]?.note.startsWith('Documented site '));
  assert.equal(plan.refusesToWrite, false);
  assert.deepEqual(plan.recordsLosingCriterion, []);
});

/* (a2) S1's own guard — a drop the rebuild cannot re-state must stop the run, not write. */
test('a dangling record whose criterion the rebuild cannot restate refuses to write', () => {
  const subject = row({
    entityId: 'ent_guard',
    claims: [claim({ id: 'claim_live_01', predicate: 'worked_as', object: 'a teacher.' })],
    publishedBasis: [
      {
        criterion: 'major_honor_or_hall_of_fame',
        note: 'Received the Congressional Gold Medal.',
        evidenceIds: ['claim_gone_99'],
      },
    ],
  });

  const plan = planNotabilityBasisResync([subject]);
  assert.deepEqual(plan.recordsLosingCriterion, ['ent_guard']);
  assert.equal(plan.refusesToWrite, true);
});

/* (b) S2 — the Quindaro / NAACP shapes: same sentence, older spelling. */
test('a note differing only by a trailing display name is refreshed and keeps its evidenceIds', () => {
  const subject = row({
    entityId: 'west_quindaro_townsite_q7272207',
    kind: 'place',
    displayName: 'Quindaro Townsite',
    claims: [
      claim({
        id: 'claim_q_03',
        // The live lane writes prose predicates with a self-naming object; that pairing is what
        // produced the stored note, and the self-naming guard is what now strips the name.
        predicate: 'hosted the first Black school west of the Mississippi River',
        object: 'Quindaro Townsite',
      }),
    ],
    publishedBasis: [
      {
        criterion: 'first_to_do_x',
        note: 'Hosted the first Black school west of the Mississippi River Quindaro Townsite.',
        evidenceIds: ['claim_q_03'],
      },
    ],
  });

  const plan = planNotabilityBasisResync([subject]);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0]?.refreshedNotes.length, 1);
  assert.equal(
    plan.changes[0]?.refreshedNotes[0]?.after,
    'Hosted the first Black school west of the Mississippi River.',
  );
  assert.deepEqual(plan.changes[0]?.basisAfter[0]?.evidenceIds, ['claim_q_03']);
  assert.equal(plan.changes[0]?.droppedDangling.length, 0);
});

test('a note differing only by a colon lead and a trailing "Cited from" is refreshed', () => {
  const subject = row({
    entityId: 'ent_naacp_org_001',
    kind: 'organization',
    displayName: 'NAACP',
    claims: [
      claim({
        id: 'claim_naacp_org_001_03',
        predicate: 'led_legal_campaign_resulting_in',
        object:
          "The NAACP's legal campaign culminated in the Supreme Court's 1954 decision in Brown " +
          'v. Board of Education.',
        citationSource: 'naacp.org',
      }),
    ],
    publishedBasis: [
      {
        criterion: 'court_precedent',
        note:
          "led legal campaign resulting in: The NAACP's legal campaign culminated in the Supreme " +
          "Court's 1954 decision in Brown v. Board of Education.. Cited from naacp.org.",
        evidenceIds: ['claim_naacp_org_001_03'],
      },
    ],
  });

  const plan = planNotabilityBasisResync([subject]);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0]?.refreshedNotes.length, 1);
  // repo-15slz: the object is already a sentence, so the builder no longer joins the predicate
  // onto its front, and S2 recognizes the stored note as that sentence with the old lead still
  // attached.
  assert.equal(
    plan.changes[0]?.refreshedNotes[0]?.after,
    "The NAACP's legal campaign culminated in the Supreme Court's 1954 decision in Brown " +
      'v. Board of Education.',
  );
});

test('a stored note that is the builder sentence with the dropped predicate lead is refreshed', () => {
  // repo-15slz, the shape the composer fix creates: the note is byte-identical to the builder's
  // apart from the lead the builder now declines to join on. Real pair from the active release.
  const subject = row({
    entityId: 'ent_andrew_young_001',
    kind: 'person',
    displayName: 'Andrew Young',
    claims: [
      claim({
        id: 'claim_andrew_young_001_02',
        predicate: 'first_to',
        object:
          'In 1977, President Carter appointed Young U.S. Ambassador to the United Nations, ' +
          'the first African American to hold the post.',
        citationSource: 'nps.gov',
      }),
    ],
    publishedBasis: [
      {
        criterion: 'first_to_do_x',
        note:
          'First to In 1977, President Carter appointed Young U.S. Ambassador to the United ' +
          'Nations, the first African American to hold the post.',
        evidenceIds: ['claim_andrew_young_001_02'],
      },
    ],
  });

  const plan = planNotabilityBasisResync([subject]);
  assert.equal(plan.changes.length, 1);
  assert.equal(
    plan.changes[0]?.refreshedNotes[0]?.after,
    'In 1977, President Carter appointed Young U.S. Ambassador to the United Nations, the ' +
      'first African American to hold the post.',
  );
});

test('a stored note that is a different sentence is not refreshed by the dropped-lead test', () => {
  // The lead tolerance must not become a general prefix match: this stored note is curated prose,
  // not the builder's sentence with a lead on it, and S2 has to leave it alone.
  assert.equal(
    notesAreSameSentence(
      'First to Tubman led the Combahee River Raid.',
      'Tubman guided Union forces up the Combahee River.',
      'Harriet Tubman',
      'first to',
    ),
    false,
  );
});

/* (c) The Tubman shape — the test that makes S2 safe. */
test('a curated note whose evidence resolves but which is a different sentence is left alone', () => {
  const subject = row({
    entityId: 'ent_harriet_tubman_001',
    displayName: 'Harriet Tubman',
    claims: [
      claim({
        id: 'claim_harriet_tubman_001_03',
        predicate: 'led',
        object:
          'On June 1-2, 1863 she guided Union Army Colonel James Montgomery and roughly 150 ' +
          'soldiers on a raid up the Combahee River, making her the first woman known to plan ' +
          'and lead a U.S. armed military operation.',
      }),
    ],
    publishedBasis: [
      {
        criterion: 'first_to_do_x',
        note:
          'First woman known to plan and lead an armed U.S. military operation — the Combahee ' +
          'River Raid, June 1-2, 1863.',
        evidenceIds: ['claim_harriet_tubman_001_03'],
      },
    ],
  });

  const plan = planNotabilityBasisResync([subject]);
  assert.deepEqual(plan.changes, []);
  assert.equal(plan.unchanged, 1);
  assert.equal(notabilityBasisIsConverged(subject), true);
});

/* (d) The repo-z1uk shape — the anti-regression for a strict recompute. */
test('a curated criterion unreachable from the claims survives untouched, evidenceIds included', () => {
  const curated = {
    criterion: 'movement_significance',
    note: 'Organized the 1963 March on Washington.',
    evidenceIds: [] as readonly string[],
  } as const;
  const subject = row({
    entityId: 'ent_bayard_rustin_001',
    displayName: 'Bayard Rustin',
    claims: [
      claim({
        id: 'claim_rustin_01',
        predicate: 'worked_as',
        object: 'an organizer and strategist.',
      }),
    ],
    publishedBasis: [curated],
  });

  const plan = planNotabilityBasisResync([subject]);
  const change = plan.changes[0];
  // The fallback record the rebuild adds is fine; what must never happen is the curated one going.
  const survivor = (change?.basisAfter ?? subject.publishedBasis).find(
    (record) => record.criterion === 'movement_significance',
  );
  assert.deepEqual(survivor, curated);
  assert.deepEqual(plan.recordsLosingCriterion, []);
  assert.equal(plan.lostCriteria.length, 0);
});

test('a record the builder can say nothing about is never rewritten (the Crescent Springs gap)', () => {
  const subject = row({
    entityId: 'sundown_crescent_springs_kentucky',
    kind: 'place',
    claims: [],
    publishedBasis: [],
  });
  const plan = planNotabilityBasisResync([subject]);
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(plan.wouldEmpty, []);
});

/* (e) The repo-rm2y / repo-8x306 "wrote one copy" trap, asserted rather than assumed. */
test('a planned change names the projection, the taxonomy when present, and the search facets', () => {
  const base = {
    claims: [claim({ id: 'claim_x_01', predicate: 'was the first to serve', object: 'as mayor.' })],
    publishedBasis: [
      { criterion: 'first_to_do_x' as const, note: 'stale note', evidenceIds: ['claim_gone'] },
    ],
  };
  const plan = planNotabilityBasisResync([
    row({ entityId: 'ent_all_three', hasTaxonomyLabels: true, hasSearchIndex: true, ...base }),
    row({ entityId: 'ent_no_taxonomy', hasTaxonomyLabels: false, hasSearchIndex: true, ...base }),
  ]);

  assert.deepEqual(plan.changes[0]?.writeTargets, [
    'release_entities.projection',
    'release_entities.taxonomy',
    'search_index.facets',
  ]);
  assert.deepEqual(plan.changes[1]?.writeTargets, [
    'release_entities.projection',
    'search_index.facets',
  ]);
});

test('applying a plan writes release_entities and search_index for every changed row', async () => {
  const plan = planNotabilityBasisResync([
    row({
      entityId: 'ent_write',
      hasTaxonomyLabels: true,
      claims: [
        claim({ id: 'claim_w_01', predicate: 'was the first to serve', object: 'as mayor.' }),
      ],
      publishedBasis: [
        { criterion: 'first_to_do_x', note: 'stale note', evidenceIds: ['claim_gone'] },
      ],
    }),
  ]);
  const client = fakeClient();
  const result = await applyNotabilityBasisResync(client, plan, 'rel_1');

  assert.equal(result.projectionRows, 1);
  assert.equal(result.searchIndexRows, 1);
  assert.equal(client.updates.length, 2);
  assert.ok(client.updates[0]?.sql.includes('bb_public.release_entities'));
  assert.ok(client.updates[0]?.sql.includes("'notabilityBasis'"));
  assert.ok(client.updates[0]?.sql.includes("'notabilityLabels'"));
  assert.ok(client.updates[0]?.sql.includes("taxonomy ? 'notabilityLabels'"));
  assert.ok(client.updates[1]?.sql.includes('bb_public.search_index'));
  // Both stores get the SAME jsonb, which is the point of writing them together.
  assert.equal(client.updates[0]?.params[0], client.updates[1]?.params[0]);
  assert.equal(client.updates[0]?.params[1], client.updates[1]?.params[1]);
  assert.deepEqual(client.updates[1]?.params[2], 'rel_1');
  assert.deepEqual(client.updates[1]?.params[3], 'ent_write');
});

test('applying a refusing plan throws instead of writing anything', async () => {
  const plan = planNotabilityBasisResync([
    row({
      entityId: 'ent_guard',
      claims: [claim({ id: 'claim_live_01', predicate: 'worked_as', object: 'a teacher.' })],
      publishedBasis: [
        {
          criterion: 'major_honor_or_hall_of_fame',
          note: 'Received the Congressional Gold Medal.',
          evidenceIds: ['claim_gone_99'],
        },
      ],
    }),
  ]);
  const client = fakeClient();
  await assert.rejects(
    () => applyNotabilityBasisResync(client, plan, 'rel_1'),
    /Refusing to write/u,
  );
  assert.equal(client.updates.length, 0);
});

test('notabilityLabelsForBasis is the rubric text for the record own criteria, deduplicated', () => {
  const labels = notabilityLabelsForBasis([
    { criterion: 'first_to_do_x', note: 'a', evidenceIds: [] },
    { criterion: 'first_to_do_x', note: 'b', evidenceIds: [] },
    { criterion: 'court_precedent', note: 'c', evidenceIds: [] },
  ]);
  assert.equal(labels.length, 2);
  assert.ok(labels.every((label) => label.length > 0));
});

test('encodeBasis is order-insensitive so a reordered list is not reported as a change', () => {
  const a = [
    { criterion: 'court_precedent' as const, note: 'n1', evidenceIds: ['c2', 'c1'] },
    { criterion: 'first_to_do_x' as const, note: 'n2', evidenceIds: ['c3'] },
  ];
  const b = [a[1]!, { ...a[0]!, evidenceIds: ['c1', 'c2'] }];
  assert.equal(encodeBasis(a), encodeBasis(b));
});
