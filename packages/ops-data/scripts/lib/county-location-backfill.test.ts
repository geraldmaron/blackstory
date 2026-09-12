import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import type { GazetteerCountyRow } from '../../src/jurisdictions/tiger-gazetteer.js';
import {
  applyCountyLocationBackfill,
  buildGazetteerBBoxIndex,
  type CountyLocationMatch,
  planCountyLocationBackfill,
} from './county-location-backfill.ts';

function gazetteerRow(
  overrides: Partial<GazetteerCountyRow> & { geoid: string },
): GazetteerCountyRow {
  return {
    usps: 'IL',
    stateFips: '17',
    countyFips3: '031',
    name: 'Cook County',
    alandSqMi: 945.192,
    awaterSqMi: 689.848,
    intptlat: 41.841,
    intptlong: -87.816,
    ...overrides,
  };
}

function fakeSelectClient(rows: readonly Record<string, unknown>[]) {
  return {
    query: async () => ({ rows }),
    // biome-ignore lint: test double, cast to the shape the module expects
  } as unknown as PoolClient;
}

function fakeUpdateClient() {
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

test('planCountyLocationBackfill matches an existing row missing location to its Gazetteer bbox by GEOID', async () => {
  const index = buildGazetteerBBoxIndex([gazetteerRow({ geoid: '17031' })]);
  const client = fakeSelectClient([{ id: 'county:17031', state_fips: '17', county_fips: '031' }]);

  const plan = await planCountyLocationBackfill(client, index);

  assert.equal(plan.matched.length, 1);
  assert.equal(plan.unmatched.length, 0);
  assert.equal(plan.matched[0]?.id, 'county:17031');
  assert.equal(plan.matched[0]?.geoid, '17031');
  const [west, south, east, north] = plan.matched[0]!.bbox;
  assert.ok(west < east && south < north, 'the resolved bbox must be a real (non-degenerate) box');
});

test('planCountyLocationBackfill reports a row unmatched when its GEOID is absent from this Gazetteer file', async () => {
  const index = buildGazetteerBBoxIndex([gazetteerRow({ geoid: '17031' })]);
  const client = fakeSelectClient([{ id: 'county:06001', state_fips: '06', county_fips: '001' }]);

  const plan = await planCountyLocationBackfill(client, index);

  assert.equal(plan.matched.length, 0);
  assert.equal(plan.unmatched.length, 1);
  assert.equal(plan.unmatched[0]?.geoid, '06001');
});

test('planCountyLocationBackfill treats a zero-area Gazetteer row as unmatched rather than emitting a degenerate bbox', async () => {
  const index = buildGazetteerBBoxIndex([
    gazetteerRow({ geoid: '99999', alandSqMi: 0, awaterSqMi: 0 }),
  ]);
  const client = fakeSelectClient([{ id: 'county:99999', state_fips: '99', county_fips: '999' }]);

  const plan = await planCountyLocationBackfill(client, index);

  assert.equal(plan.matched.length, 0);
  assert.equal(plan.unmatched.length, 1);
});

test('applyCountyLocationBackfill writes an ST_MakeEnvelope UPDATE per matched row and reports the count applied', async () => {
  const client = fakeUpdateClient();
  const matched: readonly CountyLocationMatch[] = [
    { id: 'county:17031', geoid: '17031', bbox: [-88.5, 41.5, -87.5, 42.5] },
    { id: 'county:06037', geoid: '06037', bbox: [-118.9, 33.7, -117.6, 34.8] },
  ];

  const applied = await applyCountyLocationBackfill(client, matched);

  assert.equal(applied, 2);
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[0]!.sql, /ST_MakeEnvelope\(\$1, \$2, \$3, \$4, 4326\)::geography/);
  assert.match(client.calls[0]!.sql, /WHERE id = \$5 AND kind = 'county'/);
  assert.deepEqual(client.calls[0]!.params, [-88.5, 41.5, -87.5, 42.5, 'county:17031']);
  assert.deepEqual(client.calls[1]!.params, [-118.9, 33.7, -117.6, 34.8, 'county:06037']);
});

test('applyCountyLocationBackfill applies nothing for an empty plan', async () => {
  const client = fakeUpdateClient();

  const applied = await applyCountyLocationBackfill(client, []);

  assert.equal(applied, 0);
  assert.equal(client.calls.length, 0);
});
