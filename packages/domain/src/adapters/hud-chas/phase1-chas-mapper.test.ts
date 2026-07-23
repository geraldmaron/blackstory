/**
 * Tests for Phase 1 HUD CHAS Cook County Table 20 cost-burden fixture parsing and mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME,
  HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE,
  PHASE1_HUD_CHAS_COOK_JURISDICTION_ID,
  PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID,
  PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID,
  PHASE1_HUD_CHAS_REFERENCE_PERIOD,
} from './constants.js';
import { fetchPhase1ChasObservations } from './fetch-phase1-chas.js';
import {
  assertChasCookThemeImpactRowsPresent,
  mapChasRowsToObservations,
  parseChasCookCostBurdenFixtureCsv,
} from './phase1-chas-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators',
    HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME,
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseChasCookCostBurdenFixtureCsv loads Cook black and white rows', () => {
  const { rows, rejected } = parseChasCookCostBurdenFixtureCsv(FIXTURE_CSV);
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 2);
  assertChasCookThemeImpactRowsPresent(rows);
});

test('mapChasRowsToObservations computes Table 20 cost-burden shares', () => {
  const { rows } = parseChasCookCostBurdenFixtureCsv(FIXTURE_CSV);
  const observations = mapChasRowsToObservations(rows, RETRIEVED_AT);
  assert.equal(observations.length, 2);

  const black = observations.find(
    (obs) => obs.metricId === PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID,
  );
  const white = observations.find(
    (obs) => obs.metricId === PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID,
  );
  assert.ok(black);
  assert.ok(white);
  assert.equal(black.jurisdictionId, PHASE1_HUD_CHAS_COOK_JURISDICTION_ID);
  assert.equal(black.referencePeriod, PHASE1_HUD_CHAS_REFERENCE_PERIOD);
  assert.equal(black.estimate, 44.6);
  assert.equal(white.estimate, 31.3);
  assert.equal(black.totalHouseholds, 123_774);
  assert.equal(black.costBurdenGt30Households, 55_152);
  assert.equal(white.totalHouseholds, 368_132);
  assert.equal(white.costBurdenGt30Households, 115_096);
  assert.equal(black.methodologyNote, HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE);
  assert.equal(black.source, 'hud-chas');
  assert.match(black.sourceUrl ?? '', /^https:\/\/www\.cookcountyil\.gov\//);
});

test('fetchPhase1ChasObservations loads default Cook fixture', () => {
  const result = fetchPhase1ChasObservations({ retrievedAt: RETRIEVED_AT });
  assert.equal(result.observations.length, 2);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.referencePeriod, PHASE1_HUD_CHAS_REFERENCE_PERIOD);
});
