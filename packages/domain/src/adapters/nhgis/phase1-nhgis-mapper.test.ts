/**
 * Tests for Phase 1 NHGIS Cook County race population-share fixture parsing and mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID,
  PHASE1_NHGIS_COOK_JURISDICTION_ID,
  PHASE1_NHGIS_THEME_IMPACT_DECADES,
  PHASE1_NHGIS_WHITE_POPULATION_SHARE_COUNTY_METRIC_ID,
} from './constants.js';
import { fetchPhase1NhgisObservations } from './fetch-phase1-nhgis.js';
import {
  assertNhgisThemeImpactDecadesPresent,
  mapNhgisRaceRowsToObservations,
  parseNhgisCookRacePopulationShareFixtureCsv,
} from './phase1-nhgis-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators/nhgis-cook-county-17031-race-population-share-1970-2010.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseNhgisCookRacePopulationShareFixtureCsv loads 1970–2010 Cook rows', () => {
  const { rows, rejected } = parseNhgisCookRacePopulationShareFixtureCsv(FIXTURE_CSV);
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((row) => row.decade),
    [...PHASE1_NHGIS_THEME_IMPACT_DECADES],
  );
  assert.equal(rows.every((row) => row.countyFips === '17031'), true);
});

test('parseNhgisCookRacePopulationShareFixtureCsv carries per-decade sourceUrl', () => {
  const { rows } = parseNhgisCookRacePopulationShareFixtureCsv(FIXTURE_CSV);
  const y1970 = rows.find((row) => row.decade === 1970);
  assert.ok(y1970);
  assert.match(y1970?.sourceUrl ?? '', /^https:\/\/www2\.census\.gov\//);
});

test('mapNhgisRaceRowsToObservations computes population shares with provenance quartet', () => {
  const { rows } = parseNhgisCookRacePopulationShareFixtureCsv(FIXTURE_CSV);
  assertNhgisThemeImpactDecadesPresent(rows);
  const observations = mapNhgisRaceRowsToObservations(rows, RETRIEVED_AT);
  assert.equal(observations.length, 10);

  const black1970 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '1970',
  );
  const white2010 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_NHGIS_WHITE_POPULATION_SHARE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '2010',
  );

  assert.ok(black1970);
  assert.ok(white2010);
  assert.equal(black1970?.jurisdictionId, PHASE1_NHGIS_COOK_JURISDICTION_ID);
  assert.equal(black1970?.estimate, 20.9);
  assert.equal(white2010?.estimate, 69.9);
  assert.equal(black1970?.source, 'nhgis-county-race');
  assert.match(black1970?.sourceUrl ?? '', /^https:\/\//);
  assert.equal(black1970?.retrievedAt, RETRIEVED_AT);
  assert.match(black1970?.contentHash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(
    black1970?.id,
    'obs:nhgis-black-population-share-county:county:17031:1970',
  );
});

test('fetchPhase1NhgisObservations loads the default fixture envelope', () => {
  const result = fetchPhase1NhgisObservations({
    fixtureCsvText: FIXTURE_CSV,
    fixturePath: '(test fixture)',
    retrievedAt: RETRIEVED_AT,
  });
  assert.equal(result.observations.length, 10);
  assert.deepEqual(result.decades, [...PHASE1_NHGIS_THEME_IMPACT_DECADES]);
  assert.equal(result.rejected.length, 0);
  assert.match(result.sourceUrl, /^https:\/\/www\.nhgis\.org/);
});
