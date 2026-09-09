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
  return {
    updates,
    query: async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes('entity_relationships')) return { rows: derived };
      if (sql.trimStart().startsWith('SELECT entity_id, related')) return { rows: published };
      const [related, releaseId, entityId] = params as [string, string, string];
      updates.push({ related, releaseId, entityId });
      return { rows: [] };
    },
    // biome-ignore lint: test double, cast to the shape the module expects
  } as unknown as PoolClient & { readonly updates: typeof updates };
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

test('planReleaseRelatedSync emits one entry per neighbour when several edges join the same pair', async () => {
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

test('DERIVE_SQL orders the generic related_to last so a specific type wins the pair', async () => {
  // The ordering itself is SQL, so this pins the contract the dedup depends on: whatever the
  // query yields first for a pair is what renders. Postgres sorts false before true, so
  // `(relationship_type = 'related_to')` puts every specific type ahead of the fallback.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('./release-related-sync.ts', import.meta.url), 'utf8');
  assert.match(
    source,
    /ORDER BY e\.eid, e\.other_id, \(e\.relationship_type = 'related_to'\), e\.relationship_type/,
    'related_to must sort after specific types, then ties break alphabetically',
  );
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
