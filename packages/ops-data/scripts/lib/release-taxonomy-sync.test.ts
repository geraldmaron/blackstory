import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { applyReleaseTaxonomySync, planReleaseTaxonomySync } from './release-taxonomy-sync.ts';

type Row = {
  entity_id: string;
  taxonomy: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
};

function fakeClient(rows: readonly Row[]) {
  const updates: Array<{
    topicIds: string[];
    topicTags: string[];
    releaseId: string;
    entityId: string;
  }> = [];
  const sqls: string[] = [];
  return {
    updates,
    sqls,
    query: async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes('SELECT')) {
        return { rows };
      }
      // UPDATE ... SET taxonomy = ... WHERE release_id = $3 AND entity_id = $4
      const [topicIds, topicTags, releaseId, entityId] = params as [
        string[],
        string[],
        string,
        string,
      ];
      updates.push({ topicIds, topicTags, releaseId, entityId });
      sqls.push(sql);
      return { rows: [] };
    },
    // biome-ignore lint: test double, cast to the shape the module expects
  } as unknown as PoolClient & {
    readonly updates: typeof updates;
    readonly sqls: readonly string[];
  };
}

test('planReleaseTaxonomySync proposes topics for a row with real canonical classification and no release taxonomy', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_a',
      taxonomy: {},
      classification: {
        topicIds: ['civil-rights', 'education'],
        topicTags: ['civil-rights', 'education'],
      },
    },
  ]);
  const plan = await planReleaseTaxonomySync(client, 'rel_1');
  assert.equal(plan.scanned, 1);
  assert.equal(plan.changed.length, 1);
  assert.deepEqual(plan.changed[0]?.afterTopicIds, ['civil-rights', 'education']);
  assert.equal(plan.noCanonicalTopics, 0);
  assert.equal(plan.unchanged, 0);
});

test('planReleaseTaxonomySync drops topicIds not in TOPIC_REGISTRY rather than forcing them through', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_b',
      taxonomy: {},
      classification: {
        topicIds: ['civil-rights', 'not-a-real-topic'],
        topicTags: ['civil-rights', 'freeform-tag'],
      },
    },
  ]);
  const plan = await planReleaseTaxonomySync(client, 'rel_1');
  assert.equal(plan.changed.length, 1);
  assert.deepEqual(plan.changed[0]?.afterTopicIds, ['civil-rights']);
  assert.deepEqual(plan.changed[0]?.droppedInvalidTopicIds, ['not-a-real-topic']);
  // topicTags are free-form display tags, not governed by TOPIC_REGISTRY — kept as-is.
  assert.deepEqual(plan.changed[0]?.afterTopicTags, ['civil-rights', 'freeform-tag']);
});

test('planReleaseTaxonomySync marks a row unchanged when release taxonomy already matches canonical', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_c',
      taxonomy: { topicIds: ['music'], topicTags: ['music'], notabilityLabels: ['some label'] },
      classification: { topicIds: ['music'], topicTags: ['music'] },
    },
  ]);
  const plan = await planReleaseTaxonomySync(client, 'rel_1');
  assert.equal(plan.changed.length, 0);
  assert.equal(plan.unchanged, 1);
});

test('planReleaseTaxonomySync counts a genuine canonical-data gap separately from the projection bug', async () => {
  const client = fakeClient([
    { entity_id: 'ent_d', taxonomy: {}, classification: {} },
    { entity_id: 'ent_e', taxonomy: null, classification: null },
  ]);
  const plan = await planReleaseTaxonomySync(client, 'rel_1');
  assert.equal(plan.changed.length, 0);
  assert.equal(plan.noCanonicalTopics, 2);
});

test('applyReleaseTaxonomySync merges topics into existing taxonomy, preserving other keys like notabilityLabels', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_f',
      taxonomy: { notabilityLabels: ['keep me'] },
      classification: { topicIds: ['music'], topicTags: ['music'] },
    },
  ]);
  const plan = await planReleaseTaxonomySync(client, 'rel_1');
  await applyReleaseTaxonomySync(client, 'rel_1', plan);
  assert.equal(client.updates.length, 1);
  assert.deepEqual(client.updates[0], {
    topicIds: ['music'],
    topicTags: ['music'],
    releaseId: 'rel_1',
    entityId: 'ent_f',
  });
});

/*
 * repo-ttlce. A shape test, not a behavior test, and worth saying so: a fake client cannot run
 * SQL, so what this pins is that the statement still reaches all three stores. The statement's
 * actual behavior was verified by PREPAREing it against the real schema inside a read-only
 * transaction (it parses and analyzes), and by having Postgres evaluate the topics CASE over the
 * four tag/id combinations — it agreed with `searchTopicsFromProjection` on every one, including
 * the empty-tags-with-real-ids case this bead exists to fix.
 *
 * Writing only the taxonomy column is exactly the regression that made 1,729 rows unfindable by
 * topic while the column an operator would check looked correct, so it is worth a guard even a
 * weak one.
 */
test('the taxonomy sync writes the projection and the search index, not the taxonomy column alone', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_g',
      taxonomy: {},
      classification: { topicIds: ['music'], topicTags: [] },
    },
  ]);
  const plan = await planReleaseTaxonomySync(client, 'rel_1');
  await applyReleaseTaxonomySync(client, 'rel_1', plan);

  assert.equal(client.sqls.length, 1, 'one statement, so the three stores cannot part-commit');
  const sql = client.sqls[0] ?? '';
  assert.match(sql, /UPDATE bb_public\.release_entities/u);
  assert.match(sql, /SET taxonomy =/u);
  assert.match(sql, /projection =/u, 'readers serve the projection, never the taxonomy column');
  assert.match(sql, /UPDATE bb_public\.search_index/u, 'topic browse reads search_index.topics');
  assert.match(sql, /SET topics =/u);
  assert.match(
    sql,
    /COALESCE\(array_length\(\$2::text\[\], 1\), 0\) > 0/u,
    'array_length returns NULL on an empty array, so the COALESCE is what makes the tags-else-ids ' +
      'rule fire by rule rather than by accident',
  );
});
