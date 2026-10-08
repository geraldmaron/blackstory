/**
 * Exercises promotion's transaction calls with a recording PoolClient double. Domain tests
 * cover the pure gate; this suite verifies commit and rollback orchestration, not live database
 * enforcement.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import {
  EVIDENCE_CHECKLIST_KEYS,
  MINIMUM_RECORD_CHECKLIST_KEYS,
  type CanonicalPromotionRecord,
} from '@repo/domain';
import type { AdminCaseDetail } from './research-case-types';
import {
  CasePromotionRejected,
  promoteCaseToCanonical,
  type PromoteCaseDependencies,
  type PromoteCaseInput,
} from './promote-case';

function caseDetail(overrides: Partial<AdminCaseDetail> = {}): AdminCaseDetail {
  const state = overrides.state ?? 'substantial_enrichment';
  const checklist = overrides.checklist ?? {
    items: (state === 'minimum_record'
      ? MINIMUM_RECORD_CHECKLIST_KEYS
      : EVIDENCE_CHECKLIST_KEYS
    ).map((key) => ({ key, complete: true, evidenceIds: [`evidence-${key}`] })),
  };
  const record = {
    id: 'case-1',
    state,
    candidateId: 'candidate-1',
    title: 'Boarded-up mill on Route 9',
    checklist,
    history: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  return {
    id: 'case-1',
    title: 'Boarded-up mill on Route 9',
    state,
    candidateId: 'candidate-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    checklist,
    history: [],
    record,
    ...overrides,
  } as AdminCaseDetail;
}

function promotionRecord(
  overrides: Partial<CanonicalPromotionRecord> = {},
): CanonicalPromotionRecord {
  return {
    entityId: 'entity-1',
    displayName: 'Route 9 Mill',
    summary:
      'An abandoned textile mill on Route 9, closed after the 1987 flood and never reopened; ' +
      'the site has stood vacant since, per county records and contemporary news coverage.',
    jurisdiction: 'Example County',
    topicIds: ['abandoned-industry'],
    topicTags: ['mill', 'flood'],
    eraBuckets: ['1980s'],
    location: {
      lat: 42.1,
      lng: -71.5,
      label: 'Route 9, Example County',
      precision: 'address',
      matchMethod: 'geocoded',
    },
    sources: [
      {
        url: 'https://county.example.gov/records/mill-closure',
        title: 'County closure record',
        excerpt:
          'The mill was closed permanently by county order following extensive flood damage in 1987.',
        fitness: 'authoritative',
      },
      {
        url: 'https://news.example.com/1987/mill-closes',
        title: 'Local paper coverage',
        excerpt: 'Residents recall the mill closing its doors for good after the spring flood.',
        fitness: 'strong',
      },
    ],
    ...overrides,
  };
}

function promoteInput(overrides: Partial<PromoteCaseInput> = {}): PromoteCaseInput {
  return {
    caseId: 'case-1',
    record: promotionRecord(),
    approverUid: 'user-approver',
    approverEmail: 'approver@example.com',
    reason: 'Two independent sources confirm the closure; ready for canonical.',
    ...overrides,
  };
}

/** A fake client that records every query and answers the duplicate-check SELECT. */
function fixture(
  options: {
    readonly detail?: AdminCaseDetail | null;
    readonly duplicateRows?: readonly unknown[];
  } = {},
) {
  const queries: { readonly sql: string; readonly params: readonly unknown[] }[] = [];
  const client = {
    query: async (sql: string, params?: readonly unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (sql.includes('FROM canonical.entities') && sql.includes('WHERE id = $1')) {
        const rows = options.duplicateRows ?? [];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as pg.PoolClient;

  const detail = options.detail === undefined ? caseDetail() : options.detail;
  const dependencies: PromoteCaseDependencies = {
    getCaseDetail: async () => detail,
    runTransaction: async (operation) => operation(client),
  };
  return { queries, dependencies };
}

test('a blank publisher identity is rejected with no writes', async () => {
  const { queries, dependencies } = fixture();

  await assert.rejects(
    () => promoteCaseToCanonical(promoteInput({ approverUid: '' }), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('missing_identity'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a case without the minimum record is rejected with no writes', async () => {
  const { queries, dependencies } = fixture({
    detail: caseDetail({ state: 'relevance_confirmed' }),
  });

  await assert.rejects(
    () => promoteCaseToCanonical(promoteInput(), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('case_not_ready'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a ready state with an incomplete checklist cannot promote', async () => {
  const { queries, dependencies } = fixture({
    detail: caseDetail({ state: 'minimum_record', checklist: { items: [] } }),
  });

  await assert.rejects(
    () => promoteCaseToCanonical(promoteInput(), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('minimum_record_incomplete'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a case state inconsistent with its checklist cannot promote', async () => {
  const minimumChecklist = caseDetail({ state: 'minimum_record' }).checklist;
  const { queries, dependencies } = fixture({
    detail: caseDetail({ state: 'substantial_enrichment', checklist: minimumChecklist }),
  });

  await assert.rejects(
    () => promoteCaseToCanonical(promoteInput(), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('case_checklist_inconsistent'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a minimum record without a verified pin creates an entity without a location', async () => {
  const { queries, dependencies } = fixture({
    detail: caseDetail({ state: 'minimum_record' }),
  });
  const { location: _location, ...record } = promotionRecord();

  const result = await promoteCaseToCanonical(promoteInput({ record }), dependencies);

  assert.equal(result.locationId, undefined);
  assert.ok(queries.some((query) => query.sql.includes('INSERT INTO canonical.entities')));
  assert.ok(!queries.some((query) => query.sql.includes('INSERT INTO canonical.entity_locations')));
  const entityInsert = queries.find((query) =>
    query.sql.includes('INSERT INTO canonical.entities'),
  );
  const kindDetail = JSON.parse(String(entityInsert?.params[5])) as {
    classification: { researchCoverage: string };
  };
  assert.equal(kindDetail.classification.researchCoverage, 'minimal');
});

test('a record failing content validation is rejected before any query runs', async () => {
  const { queries, dependencies } = fixture();

  await assert.rejects(
    () =>
      promoteCaseToCanonical(
        promoteInput({ record: promotionRecord({ summary: '   ' }) }),
        dependencies,
      ),
    (error: unknown) => {
      assert.ok(error instanceof CasePromotionRejected);
      assert.ok(error.reasons.includes('name_or_summary_invalid'));
      return true;
    },
  );
  assert.equal(queries.length, 0);
});

test('a live catalog duplicate aborts the transaction without inserting the entity', async () => {
  const { queries, dependencies } = fixture({
    duplicateRows: [{ id: 'entity-existing', display_name: 'Route 9 Mill' }],
  });

  await assert.rejects(() => promoteCaseToCanonical(promoteInput(), dependencies), /duplicate/i);

  // The duplicate check ran, but nothing after it did: no INSERT INTO canonical.entities.
  assert.ok(queries.some((q) => q.sql.includes('WHERE id = $1')));
  assert.ok(!queries.some((q) => q.sql.includes('INSERT INTO canonical.entities')));
});

test('an existing entity id aborts promotion rather than reusing an unrelated row', async () => {
  const { queries, dependencies } = fixture({
    duplicateRows: [{ id: 'entity-1', display_name: 'Existing record' }],
  });

  await assert.rejects(() => promoteCaseToCanonical(promoteInput(), dependencies), /duplicate/i);
  assert.ok(!queries.some((q) => q.sql.includes('INSERT INTO canonical.entities')));
});

test('a valid promotion commits the entity, claim, evidence, and case history in one pass', async () => {
  const { queries, dependencies } = fixture();

  const result = await promoteCaseToCanonical(promoteInput(), dependencies);

  assert.equal(result.entityId, 'entity-1');
  assert.ok(result.claimId.startsWith('claim_entity-1'));
  assert.equal(result.evidenceIds.length, 2);

  const sqlOf = (fragment: string) => queries.some((q) => q.sql.includes(fragment));
  assert.ok(sqlOf('INSERT INTO canonical.entities'));
  assert.ok(sqlOf('INSERT INTO canonical.entity_locations'));
  assert.ok(sqlOf('INSERT INTO canonical.claims'));
  assert.ok(sqlOf('INSERT INTO canonical.claim_versions'));
  assert.ok(sqlOf('INSERT INTO canonical.claim_evidence_links'));
  assert.ok(sqlOf('INSERT INTO research.case_history_events'));
  assert.ok(sqlOf('INSERT INTO audit.events'));

  const entityInsert = queries.find((q) => q.sql.includes('INSERT INTO canonical.entities'));
  assert.deepEqual(
    entityInsert?.params[3],
    JSON.stringify([{ scheme: 'research_case', value: 'case-1' }]),
  );

  const historyInsert = queries.find((q) =>
    q.sql.includes('INSERT INTO research.case_history_events'),
  );
  // reason_code is a SQL literal ('canonical_promotion_approved'), not a bound param.
  assert.ok(historyInsert?.sql.includes("'canonical_promotion_approved'"));
  assert.equal(historyInsert?.params[3], 'user-approver');

  const claimInsert = queries.find((q) => q.sql.includes('INSERT INTO canonical.claims'));
  const confidence = JSON.parse(String(claimInsert?.params[2])) as Record<string, unknown>;
  assert.equal(confidence.level, 'unknown');
  assert.equal(confidence.independentLineageCount, undefined);
});
