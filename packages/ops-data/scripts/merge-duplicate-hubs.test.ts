/**
 * Unit tests for the merge-scoped delete guard in merge-duplicate-hubs.ts.
 *
 * The admin console's merge path (applyEntityMerge in apps/web/src/admin/lib/entity-merge.ts)
 * only ever touches rows connected to the entities being merged; a self-loop or duplicate edge
 * that predates a merge, or belongs to an unrelated pair of entities, is left in place. These
 * tests pin the same boundary for the ops script's cleanup deletes: a row is only a deletion
 * candidate when this merge's own endpoint rewrite touched it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type pg from 'pg';
import type { HubMergePair } from './lib/entity-hub-merge.ts';
import {
  rewriteEventParticipationForPair,
  rewriteRelationshipsForPair,
} from './merge-duplicate-hubs.ts';

const PAIR: HubMergePair = {
  absorbedId: 'ent_absorbed',
  survivorId: 'ent_survivor',
  reason: 'test merge',
};

type RelationshipRow = {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: string;
};

/**
 * A minimal in-memory stand-in for bb_canonical.entity_relationships that executes exactly the
 * four query shapes rewriteRelationshipsForPair issues, so the scoping guard can be exercised
 * without a real database.
 */
function fakeRelationshipsClient(initialRows: readonly RelationshipRow[]) {
  let rows = initialRows.map((row) => ({ ...row }));
  return {
    rowsRemaining: () => rows.map((row) => row.id),
    query: async (sql: string, params?: readonly unknown[]) => {
      const text = sql.replace(/\s+/g, ' ').trim();

      if (text.includes('SET from_entity_id = $2')) {
        const [absorbedId, survivorId] = params as [string, string];
        const touched = rows.filter((row) => row.from_entity_id === absorbedId);
        for (const row of touched) row.from_entity_id = survivorId;
        return { rows: touched.map((row) => ({ id: row.id })), rowCount: touched.length };
      }
      if (text.includes('SET to_entity_id = $2')) {
        const [absorbedId, survivorId] = params as [string, string];
        const touched = rows.filter((row) => row.to_entity_id === absorbedId);
        for (const row of touched) row.to_entity_id = survivorId;
        return { rows: touched.map((row) => ({ id: row.id })), rowCount: touched.length };
      }
      if (text.includes('WHERE from_entity_id = to_entity_id')) {
        const [ids] = params as [readonly string[]];
        const before = rows.length;
        rows = rows.filter(
          (row) => !(row.from_entity_id === row.to_entity_id && ids.includes(row.id)),
        );
        return { rowCount: before - rows.length };
      }
      if (text.includes('USING bb_canonical.entity_relationships r2')) {
        const [ids] = params as [readonly string[]];
        const before = rows.length;
        const toDelete = new Set<string>();
        for (const r1 of rows) {
          for (const r2 of rows) {
            if (r1.id === r2.id) continue;
            const sameEdge =
              r1.from_entity_id === r2.from_entity_id &&
              r1.to_entity_id === r2.to_entity_id &&
              r1.relationship_type === r2.relationship_type;
            if (sameEdge && r1.id > r2.id && (ids.includes(r1.id) || ids.includes(r2.id))) {
              toDelete.add(r1.id);
            }
          }
        }
        rows = rows.filter((row) => !toDelete.has(row.id));
        return { rowCount: before - rows.length };
      }
      throw new Error(`fakeRelationshipsClient: unexpected query ${text}`);
    },
  };
}

test('rewriteRelationshipsForPair leaves a pre-existing self-loop untouched by this merge alone', async () => {
  const client = fakeRelationshipsClient([
    // Reflexive relationship on some unrelated entity, present before this merge ran.
    {
      id: 'rel-unrelated-self',
      from_entity_id: 'ent_other',
      to_entity_id: 'ent_other',
      relationship_type: 'related_to',
    },
    // The edge this merge actually needs to rewrite/collapse.
    {
      id: 'rel-created-self',
      from_entity_id: 'ent_absorbed',
      to_entity_id: 'ent_survivor',
      relationship_type: 'related_to',
    },
  ]);

  const result = await rewriteRelationshipsForPair(client as unknown as pg.PoolClient, PAIR);

  assert.equal(result.deletedSelfLoops, 1, 'only the merge-created self-loop is deleted');
  const remaining = client.rowsRemaining();
  assert.ok(
    remaining.includes('rel-unrelated-self'),
    'a self-loop unrelated to this merge must survive',
  );
  assert.ok(!remaining.includes('rel-created-self'), 'the merge-created self-loop is removed');
});

test('rewriteRelationshipsForPair leaves a pre-existing duplicate pair untouched by this merge alone', async () => {
  const client = fakeRelationshipsClient([
    // Duplicate edge between two unrelated entities, present before this merge ran.
    {
      id: 'rel-dup-old',
      from_entity_id: 'ent_x',
      to_entity_id: 'ent_y',
      relationship_type: 'related_to',
    },
    {
      id: 'rel-dup-new',
      from_entity_id: 'ent_x',
      to_entity_id: 'ent_y',
      relationship_type: 'related_to',
    },
    // The survivor already has an edge to ent_z; the absorbed entity has the same edge, which
    // becomes a genuine duplicate once this merge rewrites its endpoint onto the survivor.
    {
      id: 'rel-existing-survivor-edge',
      from_entity_id: 'ent_survivor',
      to_entity_id: 'ent_z',
      relationship_type: 'related_to',
    },
    {
      id: 'rel-absorbed-edge',
      from_entity_id: 'ent_absorbed',
      to_entity_id: 'ent_z',
      relationship_type: 'related_to',
    },
  ]);

  const result = await rewriteRelationshipsForPair(client as unknown as pg.PoolClient, PAIR);

  assert.equal(result.deletedDuplicates, 1, 'only the merge-created duplicate is collapsed');
  const remaining = client.rowsRemaining();
  assert.ok(
    remaining.includes('rel-dup-old') && remaining.includes('rel-dup-new'),
    'a duplicate pair unrelated to this merge must survive intact',
  );
  const mergeCreatedPairRemaining = remaining.filter((id) =>
    ['rel-existing-survivor-edge', 'rel-absorbed-edge'].includes(id),
  );
  assert.equal(
    mergeCreatedPairRemaining.length,
    1,
    'exactly one side of the merge-created duplicate remains',
  );
});

type ParticipationRow = {
  id: string;
  event_id: string;
  participant_id: string;
  role: string;
};

/** Same shape as fakeRelationshipsClient, for bb_canonical.event_participation. */
function fakeParticipationClient(initialRows: readonly ParticipationRow[]) {
  let rows = initialRows.map((row) => ({ ...row }));
  return {
    rowsRemaining: () => rows.map((row) => row.id),
    query: async (sql: string, params?: readonly unknown[]) => {
      const text = sql.replace(/\s+/g, ' ').trim();

      if (text.includes('SET participant_id = $2')) {
        const [absorbedId, survivorId] = params as [string, string];
        const touched = rows.filter((row) => row.participant_id === absorbedId);
        for (const row of touched) row.participant_id = survivorId;
        return { rows: touched.map((row) => ({ id: row.id })), rowCount: touched.length };
      }
      if (text.includes('SET event_id = $2')) {
        const [absorbedId, survivorId] = params as [string, string];
        const touched = rows.filter((row) => row.event_id === absorbedId);
        for (const row of touched) row.event_id = survivorId;
        return { rows: touched.map((row) => ({ id: row.id })), rowCount: touched.length };
      }
      if (text.includes('WHERE event_id = participant_id')) {
        const [ids] = params as [readonly string[]];
        const before = rows.length;
        rows = rows.filter((row) => !(row.event_id === row.participant_id && ids.includes(row.id)));
        return { rowCount: before - rows.length };
      }
      if (text.includes('USING bb_canonical.event_participation ep2')) {
        const [ids] = params as [readonly string[]];
        const before = rows.length;
        const toDelete = new Set<string>();
        for (const r1 of rows) {
          for (const r2 of rows) {
            if (r1.id === r2.id) continue;
            const sameParticipation =
              r1.event_id === r2.event_id &&
              r1.participant_id === r2.participant_id &&
              r1.role === r2.role;
            if (
              sameParticipation &&
              r1.id > r2.id &&
              (ids.includes(r1.id) || ids.includes(r2.id))
            ) {
              toDelete.add(r1.id);
            }
          }
        }
        rows = rows.filter((row) => !toDelete.has(row.id));
        return { rowCount: before - rows.length };
      }
      throw new Error(`fakeParticipationClient: unexpected query ${text}`);
    },
  };
}

test('rewriteEventParticipationForPair leaves participation rows untouched by this merge alone', async () => {
  const client = fakeParticipationClient([
    // Self-participation on an unrelated event/participant, present before this merge ran.
    {
      id: 'part-unrelated-self',
      event_id: 'evt_other',
      participant_id: 'evt_other',
      role: 'speaker',
    },
    // Duplicate participation between two unrelated ids.
    { id: 'part-dup-old', event_id: 'evt_x', participant_id: 'ent_y', role: 'speaker' },
    { id: 'part-dup-new', event_id: 'evt_x', participant_id: 'ent_y', role: 'speaker' },
    // This merge's edge: absorbed entity participates in an event the survivor already covers.
    {
      id: 'part-created-self',
      event_id: 'ent_survivor',
      participant_id: 'ent_absorbed',
      role: 'speaker',
    },
  ]);

  const result = await rewriteEventParticipationForPair(client as unknown as pg.PoolClient, PAIR);

  assert.equal(result.deletedSelfLoops, 1, 'only the merge-created self-participation is deleted');
  const remaining = client.rowsRemaining();
  assert.ok(remaining.includes('part-unrelated-self'), 'unrelated self-participation survives');
  assert.ok(
    remaining.includes('part-dup-old') && remaining.includes('part-dup-new'),
    'an unrelated duplicate participation pair survives intact',
  );
  assert.ok(
    !remaining.includes('part-created-self'),
    'the merge-created self-participation is removed',
  );
});
