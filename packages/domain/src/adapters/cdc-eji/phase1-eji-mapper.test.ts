/**
 * Unit tests for CDC EJI tract→county environmental burden rollup mapper.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE,
  PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID,
} from './constants.js';
import {
  mapEjiCountyRollupsToObservations,
  parseEjiTractCsv,
  rollupEjiTractsToCounties,
} from './phase1-eji-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators/eji-il-counties-sample.csv',
);

test('parseEjiTractCsv loads tract ranks for Cook, DuPage, and Lake counties', () => {
  const parsed = parseEjiTractCsv(readFileSync(FIXTURE_PATH, 'utf8'), ['17031', '17043', '17097']);
  assert.equal(parsed.rejected.length, 0);
  assert.equal(parsed.rows.length, 9);
  assert.equal(parsed.rows.filter((row) => row.countyFips === '17031').length, 4);
});

test('rollupEjiTractsToCounties computes unweighted county means', () => {
  const parsed = parseEjiTractCsv(readFileSync(FIXTURE_PATH, 'utf8'), ['17031', '17043', '17097']);
  const rollups = rollupEjiTractsToCounties(parsed.rows);
  const cook = rollups.find((row) => row.countyFips === '17031');
  assert.ok(cook);
  assert.equal(cook.tractCount, 4);
  assert.equal(cook.meanEnvironmentalBurdenRank, 0.74);
});

test('mapEjiCountyRollupsToObservations emits dignity-safe county drafts', () => {
  const parsed = parseEjiTractCsv(readFileSync(FIXTURE_PATH, 'utf8'), ['17031']);
  const rollups = rollupEjiTractsToCounties(parsed.rows);
  const observations = mapEjiCountyRollupsToObservations(rollups, '2024', '2026-01-01T00:00:00.000Z');
  const cook = observations[0];
  assert.ok(cook);
  assert.equal(cook.metricId, PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID);
  assert.equal(cook.jurisdictionId, 'county:17031');
  assert.equal(cook.estimate, 0.74);
  assert.equal(cook.tractCount, 4);
  assert.equal(cook.source, 'cdc-eji');
  assert.equal(cook.methodologyNote, CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE);
  assert.match(cook.methodologyNote, /not a hazard heat map/i);
});
