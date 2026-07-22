/**
 * Tests for Phase 1 NHGIS Cook County race population-share and tenure homeownership fixtures.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PHASE1_NHGIS_BLACK_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_COOK_JURISDICTION_ID,
  PHASE1_NHGIS_TENURE_HOMEOWNERSHIP_DECADES,
  PHASE1_NHGIS_THEME_IMPACT_DECADES,
  PHASE1_NHGIS_WHITE_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID,
} from './constants.js';
import { fetchPhase1NhgisObservations } from './fetch-phase1-nhgis.js';
import {
  assertNhgisTenureHomeownershipDecadesPresent,
  assertNhgisThemeImpactDecadesPresent,
  mapNhgisRaceRowsToObservations,
  mapNhgisTenureRowsToObservations,
  parseNhgisCookRacePopulationShareFixtureCsv,
  parseNhgisCookTenureHomeownershipFixtureCsv,
} from './phase1-nhgis-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
);
const RACE_FIXTURE_CSV = readFileSync(
  join(FIXTURE_DIR, 'nhgis-cook-county-17031-race-population-share-1970-2010.csv'),
  'utf8',
);
const TENURE_FIXTURE_CSV = readFileSync(
  join(
    FIXTURE_DIR,
    'nhgis-cook-county-17031-tenure-homeownership-by-race-1990-2010.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseNhgisCookRacePopulationShareFixtureCsv loads 1970–2010 Cook rows', () => {
  const { rows, rejected } = parseNhgisCookRacePopulationShareFixtureCsv(RACE_FIXTURE_CSV);
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((row) => row.decade),
    [...PHASE1_NHGIS_THEME_IMPACT_DECADES],
  );
  assert.equal(rows.every((row) => row.countyFips === '17031'), true);
});

test('parseNhgisCookTenureHomeownershipFixtureCsv loads 1990–2010 Cook rows', () => {
  const { rows, rejected } = parseNhgisCookTenureHomeownershipFixtureCsv(TENURE_FIXTURE_CSV);
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.decade),
    [...PHASE1_NHGIS_TENURE_HOMEOWNERSHIP_DECADES],
  );
});

test('mapNhgisTenureRowsToObservations computes homeownership rates with provenance', () => {
  const { rows } = parseNhgisCookTenureHomeownershipFixtureCsv(TENURE_FIXTURE_CSV);
  assertNhgisTenureHomeownershipDecadesPresent(rows);
  const observations = mapNhgisTenureRowsToObservations(rows, RETRIEVED_AT);
  assert.equal(observations.length, 6);

  const black1990 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_NHGIS_BLACK_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '1990',
  );
  const white2010 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_NHGIS_WHITE_HOMEOWNERSHIP_RATE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '2010',
  );

  assert.ok(black1990);
  assert.ok(white2010);
  assert.equal(black1990?.estimate, 37.1);
  assert.equal(white2010?.estimate, 67.2);
  assert.equal(black1990?.ownerOccupied, 161406);
  assert.equal(black1990?.occupiedUnits, 434573);
  assert.equal(black1990?.source, 'nhgis-county-race');
  assert.match(black1990?.sourceUrl ?? '', /^https:\/\//);
});

test('mapNhgisRaceRowsToObservations computes population shares with provenance quartet', () => {
  const { rows } = parseNhgisCookRacePopulationShareFixtureCsv(RACE_FIXTURE_CSV);
  assertNhgisThemeImpactDecadesPresent(rows);
  const observations = mapNhgisRaceRowsToObservations(rows, RETRIEVED_AT);
  assert.equal(observations.length, 10);

  const black1970 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '1970',
  );

  assert.ok(black1970);
  assert.equal(black1970?.jurisdictionId, PHASE1_NHGIS_COOK_JURISDICTION_ID);
  assert.equal(black1970?.estimate, 20.9);
});

test('fetchPhase1NhgisObservations loads race and tenure fixture envelopes', () => {
  const result = fetchPhase1NhgisObservations({
    fixtureCsvText: RACE_FIXTURE_CSV,
    fixturePath: '(test race fixture)',
    tenureFixtureCsvText: TENURE_FIXTURE_CSV,
    tenureFixturePath: '(test tenure fixture)',
    retrievedAt: RETRIEVED_AT,
  });
  assert.equal(result.observations.length, 16);
  assert.deepEqual(result.decades, [...PHASE1_NHGIS_THEME_IMPACT_DECADES]);
  assert.deepEqual(result.tenureDecades, [...PHASE1_NHGIS_TENURE_HOMEOWNERSHIP_DECADES]);
  assert.equal(result.rejected.length, 0);
  assert.match(result.sourceUrl, /^https:\/\/www\.nhgis\.org/);
});
