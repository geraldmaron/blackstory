/**
 * Tests the SQL/parameter shape upsertCountyBatch sends to Postgres, against a fake client
 * (no live database — see the module doc on upsertCountyBatch for why `location` must be an
 * ST_MakeEnvelope polygon rather than a bare point).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import type { ReferenceCountySeed } from './lib/reference-county-seeds.ts';
import { type GazetteerProvenance, upsertCountyBatch } from './load-reference-counties.ts';

function fakeClient() {
  const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, params?: readonly unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      return { rows: [] };
    },
    // biome-ignore lint: test double, cast to the shape the module expects
  } as unknown as PoolClient & { readonly calls: typeof calls };
}

const PROVENANCE: GazetteerProvenance = {
  source: 'census-gazetteer-counties',
  sourceUrl: 'https://example.test/2024_Gaz_counties_national.zip',
  retrievedAt: '2026-01-01T00:00:00.000Z',
  contentHash: 'deadbeef',
};

const COOK_COUNTY: ReferenceCountySeed = {
  id: 'county:17031',
  kind: 'county',
  name: 'Cook County',
  stateFips: '17',
  countyFips: '031',
  parentId: 'state:17',
  bbox: [-88.5, 41.5, -87.5, 42.5],
};

test('upsertCountyBatch writes location as an ST_MakeEnvelope polygon, matching the geography(Polygon,4326) column', async () => {
  const client = fakeClient();

  await upsertCountyBatch(client, [COOK_COUNTY], PROVENANCE);

  assert.equal(client.calls.length, 1);
  const { sql, params } = client.calls[0]!;
  assert.match(
    sql,
    /ST_MakeEnvelope\(bbox_west, bbox_south, bbox_east, bbox_north, 4326\)::geography/,
  );
  assert.match(sql, /location = EXCLUDED\.location/);
  assert.match(sql, /\(id, kind, name, state_fips, county_fips, parent_id, metadata, location\)/);

  const [ids, kinds, names, stateFips, countyFips, parentIds, metadata, west, south, east, north] =
    params as [
      string[],
      string[],
      string[],
      string[],
      string[],
      string[],
      string[],
      number[],
      number[],
      number[],
      number[],
    ];
  assert.deepEqual(ids, ['county:17031']);
  assert.deepEqual(kinds, ['county']);
  assert.deepEqual(names, ['Cook County']);
  assert.deepEqual(stateFips, ['17']);
  assert.deepEqual(countyFips, ['031']);
  assert.deepEqual(parentIds, ['state:17']);
  assert.deepEqual(west, [-88.5]);
  assert.deepEqual(south, [41.5]);
  assert.deepEqual(east, [-87.5]);
  assert.deepEqual(north, [42.5]);
  assert.equal(JSON.parse(metadata[0]!).geoid, '17031');
});

test('upsertCountyBatch guards a degenerate zero-area bbox to NULL rather than an invalid envelope', async () => {
  const client = fakeClient();
  const degenerate: ReferenceCountySeed = {
    ...COOK_COUNTY,
    id: 'county:99999',
    bbox: [-100, 40, -100, 40],
  };

  await upsertCountyBatch(client, [degenerate], PROVENANCE);

  const { sql, params } = client.calls[0]!;
  assert.match(sql, /CASE\s+WHEN bbox_west < bbox_east AND bbox_south < bbox_north/);
  const [, , , , , , , west, south, east, north] = params as [
    string[],
    string[],
    string[],
    string[],
    string[],
    string[],
    string[],
    number[],
    number[],
    number[],
    number[],
  ];
  // The degenerate values still travel to Postgres unchanged; the CASE guard in the SQL text
  // (asserted above) is what turns them into NULL rather than an invalid envelope.
  assert.deepEqual(west, [-100]);
  assert.deepEqual(east, [-100]);
  assert.deepEqual(south, [40]);
  assert.deepEqual(north, [40]);
});

test('upsertCountyBatch batches multiple seeds into one query call', async () => {
  const client = fakeClient();
  const second: ReferenceCountySeed = {
    ...COOK_COUNTY,
    id: 'county:06037',
    name: 'Los Angeles County',
    stateFips: '06',
    countyFips: '037',
    parentId: 'state:06',
    bbox: [-118.9, 33.7, -117.6, 34.8],
  };

  await upsertCountyBatch(client, [COOK_COUNTY, second], PROVENANCE);

  assert.equal(client.calls.length, 1);
  const [ids] = client.calls[0]!.params as [string[]];
  assert.deepEqual(ids, ['county:17031', 'county:06037']);
});
