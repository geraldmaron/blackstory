/**
 * Unit tests for the shared search-facet realign engine. A fake client stands in for Postgres:
 * it answers the one `SELECT` this module issues with canned rows and records every `UPDATE` it
 * is given, so every target mode is exercised without a database.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applySearchFacetRealign,
  planSearchFacetRealign,
  type SearchFacetRealignClient,
} from './search-facet-realign.ts';

type Row = {
  entity_id: string;
  kind: string;
  facets: Record<string, unknown>;
  status: string | null;
  topics: string[] | null;
  projection: Record<string, unknown>;
};

function fakeClient(rows: readonly Row[]) {
  const updates: Array<{ sql: string; params: readonly unknown[] }> = [];
  const client: SearchFacetRealignClient & { readonly updates: typeof updates } = {
    updates,
    query: async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes('SELECT')) {
        return { rows: rows as unknown as Record<string, unknown>[] };
      }
      updates.push({ sql, params: params ?? [] });
      return { rows: [], rowCount: 1 };
    },
  };
  return client;
}

test('array-facet: fills an empty facet from a non-empty projection array', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_a',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: { eraBuckets: ['reconstruction'] },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['eraBuckets'] });
  assert.equal(plan.targets[0]?.filled, 1);
  assert.equal(plan.targets[0]?.facetOnly, 0);
  assert.equal(plan.changes.length, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { eraBuckets: ['reconstruction'] });
});

test('array-facet: never blanks a facet the projection lacks (facet-only, left alone)', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_b',
      kind: 'person',
      facets: { eraBuckets: ['jim_crow'] },
      status: null,
      topics: null,
      projection: {},
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['eraBuckets'] });
  assert.equal(plan.targets[0]?.facetOnly, 1);
  assert.equal(plan.changes.length, 0);
});

test('array-facet: a disagreement is reported but not written unless resolveConflicts is set', async () => {
  const rows: Row[] = [
    {
      entity_id: 'ent_c',
      kind: 'person',
      facets: { eraBuckets: ['jim_crow'] },
      status: null,
      topics: null,
      projection: { eraBuckets: ['reconstruction'] },
    },
  ];
  const withoutResolve = await planSearchFacetRealign(fakeClient(rows), { keys: ['eraBuckets'] });
  assert.equal(withoutResolve.targets[0]?.leftConflicts, 1);
  assert.equal(withoutResolve.changes.length, 0);

  const withResolve = await planSearchFacetRealign(fakeClient(rows), {
    keys: ['eraBuckets'],
    resolveConflicts: true,
  });
  assert.equal(withResolve.targets[0]?.resolved, 1);
  assert.deepEqual(withResolve.changes[0]?.facetsPatch, { eraBuckets: ['reconstruction'] });
});

test('scalar-facet: jurisdiction reads a different projection key than it writes, and trims whitespace-only as empty', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_d',
      kind: 'place',
      facets: { jurisdictionState: '   ' },
      status: null,
      topics: null,
      projection: { jurisdictionLabel: 'Kendleton, Texas' },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['jurisdictionState'] });
  assert.equal(plan.targets[0]?.filled, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { jurisdictionState: 'Kendleton, Texas' });
});

test('scalar-facet: summary copies projection.summary into facets.summary', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_e',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: { summary: 'A long biographical summary.' },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['summary'] });
  assert.equal(plan.targets[0]?.filled, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { summary: 'A long biographical summary.' });
});

test('topics-column: fills the topics COLUMN (not a facets key) from projection.topicIds', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_marjorie_joyner_001',
      kind: 'invention',
      facets: { topicIds: ['invention', 'business'] },
      status: null,
      topics: [],
      projection: { topicIds: ['invention', 'business', 'women', 'community'] },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['topics'] });
  assert.equal(plan.targets[0]?.filled, 1);
  assert.deepEqual(plan.changes[0]?.topicsColumn, ['invention', 'business', 'women', 'community']);
  // Never touches facets — mapPostgresSearchIndexRow reads the column first.
  assert.deepEqual(plan.changes[0]?.facetsPatch, {});
});

test('topics-column: an empty projection.topicIds never blanks an existing topics column', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_f',
      kind: 'person',
      facets: {},
      status: null,
      topics: ['music'],
      projection: {},
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['topics'] });
  assert.equal(plan.targets[0]?.facetOnly, 1);
  assert.equal(plan.changes.length, 0);
});

test('status-column: reads the status COLUMN before facets.status, and always resolves a mismatch (no OVERWRITE_CONFLICTS needed)', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_g',
      kind: 'person',
      facets: { status: 'living' },
      status: 'living',
      topics: null,
      projection: { status: 'deceased' },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['status'] });
  assert.equal(plan.targets[0]?.resolved, 1);
  assert.equal(plan.targets[0]?.leftConflicts, 0);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { status: 'deceased' });
  assert.equal(plan.changes[0]?.statusColumn, 'deceased');
});

test('status-column: a facet-only status (column null, facets set) is still read via the coalesce precedence', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_h',
      kind: 'person',
      facets: { status: 'unknown' },
      status: null,
      topics: null,
      projection: { status: 'deceased' },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['status'] });
  assert.equal(plan.targets[0]?.resolved, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { status: 'deceased' });
});

test('confidence-tier: a single-lineage claim is capped one grade below its raw strength', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_i',
      kind: 'person',
      facets: { confidenceTier: 'high' },
      status: null,
      topics: null,
      projection: {
        claims: [{ confidenceLevel: 'high', citationSource: 'loc.gov', claimRole: 'evidence' }],
      },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
  // One corroborating lineage only -> capped from 'high' to 'medium'.
  assert.equal(plan.targets[0]?.resolved, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { confidenceTier: 'medium' });
});

test('confidence-tier: two independent corroborating lineages keep the strongest grade', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_j',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: {
        claims: [
          { confidenceLevel: 'high', citationSource: 'loc.gov', claimRole: 'evidence' },
          { confidenceLevel: 'high', citationSource: 'nps.gov', claimRole: 'evidence' },
        ],
      },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
  assert.equal(plan.targets[0]?.filled, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { confidenceTier: 'high' });
});

test('confidence-tier: keeps the claimRole-only lineage rule — a record_index claim never corroborates', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_k',
      kind: 'place',
      facets: {},
      status: null,
      topics: null,
      projection: {
        claims: [
          { confidenceLevel: 'high', citationSource: 'nara.gov', claimRole: 'evidence' },
          // Same lineage cited twice, once as the record's own index row — must not corroborate.
          { confidenceLevel: 'high', citationSource: 'nps.gov', claimRole: 'record_index' },
        ],
      },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
  assert.deepEqual(plan.changes[0]?.facetsPatch, { confidenceTier: 'medium' });
});

test('confidence-tier: Wikipedia alone never corroborates and is capped, never unrated', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_l',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: {
        claims: [
          { confidenceLevel: 'high', citationSource: 'en.wikipedia.org', claimRole: 'evidence' },
        ],
      },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
  assert.deepEqual(plan.changes[0]?.facetsPatch, { confidenceTier: 'medium' });
});

test('confidence-tier: no citations at all computes unrated, and an absent facet is filled with it', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_m',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: { claims: [] },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
  // Matches backfill-search-facets-confidence.ts today: COMPUTED_TIER is a total function, so an
  // absent facet ('' under the SQL script's own coalesce) is filled with the explicit 'unrated'
  // grade rather than left alone — the reader distinguishes "assessed, unrated" from "no data".
  assert.equal(plan.targets[0]?.filled, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { confidenceTier: 'unrated' });
});

test('confidence-tier: an already-correct unrated facet is left unchanged', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_m2',
      kind: 'person',
      facets: { confidenceTier: 'unrated' },
      status: null,
      topics: null,
      projection: { claims: [] },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['confidenceTier'] });
  assert.equal(plan.targets[0]?.filled, 0);
  assert.equal(plan.targets[0]?.resolved, 0);
  assert.equal(plan.changes.length, 0);
});

test('multiple targets in one pass merge into a single change per row', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_marjorie_joyner_001',
      kind: 'invention',
      facets: {},
      status: null,
      topics: [],
      projection: { summary: 'An inventor and entrepreneur.', topicIds: ['invention', 'business'] },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['summary', 'topics'] });
  assert.equal(plan.changes.length, 1);
  assert.deepEqual(plan.changes[0]?.facetsPatch, { summary: 'An inventor and entrepreneur.' });
  assert.deepEqual(plan.changes[0]?.topicsColumn, ['invention', 'business']);
});

test('an unknown key is rejected before any query runs', async () => {
  const client = fakeClient([]);
  await assert.rejects(
    () => planSearchFacetRealign(client, { keys: ['notARealFacet'] }),
    /Unknown search-facet realign key/,
  );
});

test('applySearchFacetRealign issues one UPDATE per changed row and reports rows updated', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_n',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: { eraBuckets: ['reconstruction'] },
    },
  ]);
  const plan = await planSearchFacetRealign(client, { keys: ['eraBuckets'] });
  const updated = await applySearchFacetRealign(client, plan);
  assert.equal(updated, 1);
  assert.equal(client.updates.length, 1);
  assert.match(client.updates[0]?.sql ?? '', /UPDATE bb_public\.search_index/);
});

test('planSearchFacetRealign never writes — a plan-only call issues no UPDATE', async () => {
  const client = fakeClient([
    {
      entity_id: 'ent_o',
      kind: 'person',
      facets: {},
      status: null,
      topics: null,
      projection: { eraBuckets: ['reconstruction'] },
    },
  ]);
  await planSearchFacetRealign(client, { keys: ['eraBuckets'] });
  assert.equal(client.updates.length, 0);
});
