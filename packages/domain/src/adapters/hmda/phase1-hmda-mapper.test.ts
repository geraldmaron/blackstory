/**
 * Unit tests for HMDA county aggregate mapper — fixture JSON only (no live FFIEC calls).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  HMDA_AGGREGATE_STRATEGY_NOTE,
  PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID,
} from './constants.js';
import {
  mapHmdaCountyCountsToObservations,
  parseHmdaCountyAggregationResponse,
  type HmdaAggregationsResponse,
} from './phase1-hmda-mapper.js';
import { normalizeHmdaAggregationPayloadForCountyYear } from './fetch-phase1-hmda-aggregates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures/cook-county-17031-aggregations-sample.json');

function loadFixture(): HmdaAggregationsResponse {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as HmdaAggregationsResponse;
}

test('parseHmdaCountyAggregationResponse rolls up race-year application and denial counts', () => {
  const parsed = parseHmdaCountyAggregationResponse(loadFixture(), '17031');
  assert.equal(parsed.rejected.length, 0);
  assert.equal(parsed.rows.length, 4);

  const white2022 = parsed.rows.find((row) => row.race === 'White' && row.referenceYear === 2022);
  assert.ok(white2022);
  assert.equal(white2022.applications, 12450 + 320 + 890);
  assert.equal(white2022.denials, 890);

  const black2023 = parsed.rows.find(
    (row) => row.race === 'Black or African American' && row.referenceYear === 2023,
  );
  assert.ok(black2023);
  assert.equal(black2023.applications, 4510 + 130 + 580);
  assert.equal(black2023.denials, 580);
});

test('mapHmdaCountyCountsToObservations emits black, white, and gap denial rates', () => {
  const parsed = parseHmdaCountyAggregationResponse(loadFixture(), '17031');
  const observations = mapHmdaCountyCountsToObservations(parsed.rows, '2026-01-01T00:00:00.000Z');

  const black2022 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID &&
      obs.referencePeriod === '2022',
  );
  assert.ok(black2022);
  assert.equal(black2022.jurisdictionId, 'county:17031');
  assert.equal(black2022.estimate, 10.9);
  assert.equal(black2022.applicationCount, 5575);
  assert.equal(black2022.denialCount, 610);
  assert.equal(black2022.methodologyNote, HMDA_AGGREGATE_STRATEGY_NOTE);
  assert.equal(black2022.source, 'hmda-loan-level');

  const white2022 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '2022',
  );
  assert.ok(white2022);
  assert.equal(white2022.estimate, 6.5);

  const gap2022 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID &&
      obs.referencePeriod === '2022',
  );
  assert.ok(gap2022);
  assert.equal(gap2022.estimate, 4.4);
  assert.equal(gap2022.raceEthnicitySlice, undefined);

  assert.equal(observations.filter((obs) => obs.referencePeriod === '2023').length, 3);
});

test('parseHmdaCountyAggregationResponse accepts live FFIEC shape (county singular, no slice year)', () => {
  const liveShaped: HmdaAggregationsResponse = {
    parameters: {
      county: '17031',
      actions_taken: '1,2,3',
      races: 'White,Black or African American',
    },
    aggregations: [
      { count: 100, actions_taken: '1', races: 'White' },
      { count: 10, actions_taken: '3', races: 'White' },
      { count: 50, actions_taken: '1', races: 'Black or African American' },
      { count: 20, actions_taken: '3', races: 'Black or African American' },
    ],
  };

  const normalized = normalizeHmdaAggregationPayloadForCountyYear(liveShaped, '17031', 2022);
  const parsed = parseHmdaCountyAggregationResponse(normalized, '17031');
  assert.equal(parsed.rejected.length, 0);
  assert.equal(parsed.rows.length, 2);
  const black = parsed.rows.find((row) => row.race === 'Black or African American');
  assert.ok(black);
  assert.equal(black.referenceYear, 2022);
  assert.equal(black.applications, 70);
  assert.equal(black.denials, 20);
});
