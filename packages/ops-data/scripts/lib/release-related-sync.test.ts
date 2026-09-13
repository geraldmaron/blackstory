import {
  compareRelationshipCausalWeight,
  RELATIONSHIP_CAUSAL_WEIGHT,
} from '@repo/domain-core/relationship';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { applyReleaseRelatedSync, planReleaseRelatedSync } from './release-related-sync.ts';

type DerivedRow = {
  entity_id: string;
  other_id: string;
  relationship_type: string;
  direction: 'outgoing' | 'incoming';
};
type PublishedRow = { entity_id: string; related: unknown };

function fakeClient(derived: readonly DerivedRow[], published: readonly PublishedRow[]) {
  const updates: Array<{ related: string; releaseId: string; entityId: string }> = [];
  const queries: string[] = [];
  return {
    updates,
    queries,
    query: async (sql: string, params?: readonly unknown[]) => {
      queries.push(sql);
      if (sql.includes('entity_relationships')) return { rows: derived };
      if (sql.trimStart().startsWith('SELECT entity_id, related')) return { rows: published };
      const [related, releaseId, entityId] = params as [string, string, string];
      updates.push({ related, releaseId, entityId });
      return { rows: [] };
    },
    // biome-ignore lint: test double, cast to the shape the module expects
  } as unknown as PoolClient & {
    readonly updates: typeof updates;
    readonly queries: typeof queries;
  };
}

test('planReleaseRelatedSync repairs a row whose related[] was wiped by a republish', async () => {
  const client = fakeClient(
    [
      {
        entity_id: 'ent_a',
        other_id: 'ent_b',
        relationship_type: 'invented',
        direction: 'outgoing',
      },
      {
        entity_id: 'ent_a',
        other_id: 'ent_c',
        relationship_type: 'authored',
        direction: 'outgoing',
      },
    ],
    [{ entity_id: 'ent_a', related: [] }],
  );

  const plan = await planReleaseRelatedSync(client, 'rel_1');

  assert.equal(plan.changed.length, 1);
  assert.equal(plan.repaired, 1);
  assert.deepEqual(plan.changed[0]?.after, [
    { id: 'ent_b', type: 'invented', direction: 'outgoing' },
    { id: 'ent_c', type: 'authored', direction: 'outgoing' },
  ]);
});

test('planReleaseRelatedSync replaces a stale non-empty list, which an empty-only guard cannot reach', async () => {
  // The Garrett Morgan case: one surviving 'authored' edge, both inventions missing.
  const client = fakeClient(
    [
      {
        entity_id: 'ent_a',
        other_id: 'ent_b',
        relationship_type: 'invented',
        direction: 'outgoing',
      },
      {
        entity_id: 'ent_a',
        other_id: 'ent_c',
        relationship_type: 'invented',
        direction: 'outgoing',
      },
      {
        entity_id: 'ent_a',
        other_id: 'ent_d',
        relationship_type: 'authored',
        direction: 'outgoing',
      },
    ],
    [{ entity_id: 'ent_a', related: [{ id: 'ent_d', type: 'authored', direction: 'outgoing' }] }],
  );

  const plan = await planReleaseRelatedSync(client, 'rel_1');

  assert.equal(plan.changed.length, 1);
  assert.equal(plan.repaired, 0, 'not a repair — it had a list, it was just wrong');
  assert.equal(plan.changed[0]?.after.length, 3);
});

test('planReleaseRelatedSync leaves a correct list alone regardless of stored order', async () => {
  const client = fakeClient(
    [
      {
        entity_id: 'ent_a',
        other_id: 'ent_b',
        relationship_type: 'invented',
        direction: 'outgoing',
      },
      {
        entity_id: 'ent_a',
        other_id: 'ent_c',
        relationship_type: 'authored',
        direction: 'incoming',
      },
    ],
    [
      {
        entity_id: 'ent_a',
        related: [
          { id: 'ent_c', type: 'authored', direction: 'incoming' },
          { id: 'ent_b', type: 'invented', direction: 'outgoing' },
        ],
      },
    ],
  );

  const plan = await planReleaseRelatedSync(client, 'rel_1');

  assert.equal(plan.changed.length, 0);
  assert.equal(plan.unchanged, 1);
});

test('planReleaseRelatedSync emits one entry per neighbor when several edges join the same pair', async () => {
  const client = fakeClient(
    [
      {
        entity_id: 'ent_a',
        other_id: 'ent_b',
        relationship_type: 'authored',
        direction: 'outgoing',
      },
      {
        entity_id: 'ent_a',
        other_id: 'ent_b',
        relationship_type: 'invented',
        direction: 'outgoing',
      },
    ],
    [{ entity_id: 'ent_a', related: [] }],
  );

  const plan = await planReleaseRelatedSync(client, 'rel_1');

  assert.deepEqual(plan.changed[0]?.after, [
    { id: 'ent_b', type: 'authored', direction: 'outgoing' },
  ]);
});

test('DERIVE_SQL ranks by RELATIONSHIP_CAUSAL_WEIGHT, then alphabetically, with related_to always last', async () => {
  // The ordering itself is SQL, so this pins the contract the dedup depends on: whatever the
  // query yields first for a pair is what renders. Capture the actual runtime SQL text (not the
  // .ts source, which only holds the template that generates it) so a drift between the SQL and
  // RELATIONSHIP_CAUSAL_WEIGHT (packages/domain-core/src/relationship.ts) fails here.
  const client = fakeClient([], [{ entity_id: 'ent_a', related: [] }]);
  await planReleaseRelatedSync(client, 'rel_1');
  const deriveSql = client.queries.find((sql) => sql.includes('entity_relationships'));
  assert.ok(deriveSql, 'expected the edges-deriving query to have run');

  assert.match(
    deriveSql,
    /ORDER BY e\.eid, e\.other_id, CASE e\.relationship_type[\s\S]*END, e\.relationship_type/,
    'must order by the generated causal-weight CASE, then alphabetically as the tie-break',
  );

  for (const [type, weight] of Object.entries(RELATIONSHIP_CAUSAL_WEIGHT)) {
    assert.match(
      deriveSql,
      new RegExp(`WHEN '${type}' THEN ${weight}\\b`),
      `expected the generated CASE to rank "${type}" at weight ${weight}`,
    );
  }

  const maxWeight = Math.max(...Object.values(RELATIONSHIP_CAUSAL_WEIGHT));
  assert.equal(
    RELATIONSHIP_CAUSAL_WEIGHT.related_to,
    maxWeight,
    'related_to must carry the highest (weakest) weight so it always sorts last',
  );
});

test('the owner-ruling exemplar end to end: sorted by the real causal-weight comparator, the dedup keeps participated_in over attended', async () => {
  // Real shape (rel_20260723_authority_net_001): Amelia Boynton Robinson's edge to the Selma to
  // Montgomery marches carries both `attended` and `participated_in`. This composes the actual
  // domain-core comparator DERIVE_SQL's CASE reproduces with the sync module's own dedup rule
  // ("first edge for the pair wins") to prove the two together resolve the pair to
  // participated_in — not by hand-picking a row order, but by sorting with the same ranking
  // function DERIVE_SQL is generated from, starting from the alphabetical order (attended before
  // participated_in) that used to win.
  const orderedTypes = (['attended', 'participated_in'] as const)
    .slice()
    .sort(compareRelationshipCausalWeight);
  assert.deepEqual(
    orderedTypes,
    ['participated_in', 'attended'],
    'sanity: the comparator flips it',
  );

  const client = fakeClient(
    orderedTypes.map((relationship_type) => ({
      entity_id: 'ent_amelia_boynton_robinson_001',
      other_id: 'ent_selma_to_montgomery_marches_001',
      relationship_type,
      direction: 'outgoing' as const,
    })),
    [{ entity_id: 'ent_amelia_boynton_robinson_001', related: [] }],
  );

  const plan = await planReleaseRelatedSync(client, 'rel_1');

  assert.deepEqual(plan.changed[0]?.after, [
    {
      id: 'ent_selma_to_montgomery_marches_001',
      type: 'participated_in',
      direction: 'outgoing',
    },
  ]);
});

test('planReleaseRelatedSync ignores a legacy non-array related value instead of throwing', async () => {
  const client = fakeClient([], [{ entity_id: 'ent_a', related: {} }]);

  const plan = await planReleaseRelatedSync(client, 'rel_1');

  assert.equal(plan.changed.length, 0, 'no edges and nothing valid stored — nothing to write');
  assert.equal(plan.unchanged, 1);
});

test('applyReleaseRelatedSync writes the related jsonb once per changed row', async () => {
  const client = fakeClient(
    [
      {
        entity_id: 'ent_a',
        other_id: 'ent_b',
        relationship_type: 'invented',
        direction: 'outgoing',
      },
    ],
    [{ entity_id: 'ent_a', related: [] }],
  );

  const plan = await planReleaseRelatedSync(client, 'rel_1');
  await applyReleaseRelatedSync(client, 'rel_1', plan);

  assert.equal(client.updates.length, 1);
  assert.equal(client.updates[0]?.entityId, 'ent_a');
  assert.equal(client.updates[0]?.releaseId, 'rel_1');
  assert.deepEqual(JSON.parse(client.updates[0]!.related), [
    { id: 'ent_b', type: 'invented', direction: 'outgoing' },
  ]);
});
