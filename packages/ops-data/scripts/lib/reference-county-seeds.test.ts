/**
 * Tests for Postgres reference county seed mapping from Gazetteer rows.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseGazetteerCountyFile } from '../../src/jurisdictions/tiger-gazetteer.js';
import { buildReferenceCountySeeds } from './reference-county-seeds.js';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../src/jurisdictions/fixtures/sample-gazetteer-counties.txt', import.meta.url),
);

test('buildReferenceCountySeeds uses Postgres id hierarchy and excludes territories', async () => {
  const text = await readFile(FIXTURE_PATH, 'utf-8');
  const { rows } = parseGazetteerCountyFile(text);
  const { seeds, outOfScope } = buildReferenceCountySeeds(rows);

  assert.equal(seeds.length, 4);
  assert.equal(outOfScope.length, 1);
  assert.equal(outOfScope[0]?.geoid, '72001');

  const montgomery = seeds.find((seed) => seed.id === 'county:17031');
  assert.ok(montgomery);
  assert.equal(montgomery!.parentId, 'state:17');
  assert.equal(montgomery!.countyFips, '031');
  assert.equal(montgomery!.kind, 'county');
});

test('buildReferenceCountySeeds carries an approximate bbox centered on the Gazetteer centroid', async () => {
  const text = await readFile(FIXTURE_PATH, 'utf-8');
  const { rows } = parseGazetteerCountyFile(text);
  const { seeds } = buildReferenceCountySeeds(rows);

  const cook = seeds.find((seed) => seed.id === 'county:17031');
  assert.ok(cook);
  const [west, south, east, north] = cook!.bbox;
  assert.ok(west < east, 'bbox west edge must be strictly west of the east edge');
  assert.ok(south < north, 'bbox south edge must be strictly south of the north edge');
  assert.ok(west < -87.816 && east > -87.816, 'bbox must contain the county centroid longitude');
  assert.ok(south < 41.841 && north > 41.841, 'bbox must contain the county centroid latitude');
});
