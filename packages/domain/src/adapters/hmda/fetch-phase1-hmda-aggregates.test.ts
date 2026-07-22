/**
 * Fetch-layer tests for HMDA county aggregates — fixture payloads only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID,
} from './constants.js';
import { fetchPhase1HmdaCountyObservations } from './fetch-phase1-hmda-aggregates.js';
import type { HmdaAggregationsResponse } from './phase1-hmda-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures/cook-county-17031-aggregations-sample.json');

test('fetchPhase1HmdaCountyObservations maps fixture payloads for Cook County years', async () => {
  const payload = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as HmdaAggregationsResponse;
  const payloads = new Map<number, HmdaAggregationsResponse>([
    [2022, payload],
    [2023, payload],
  ]);

  const result = await fetchPhase1HmdaCountyObservations({
    countyFips: '17031',
    years: [2022, 2023],
    aggregationPayloads: payloads,
    retrievedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(result.countyFips, '17031');
  assert.equal(result.observations.length, 6);
  assert.ok(
    result.observations.some(
      (obs) =>
        obs.metricId === PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID &&
        obs.referencePeriod === '2022',
    ),
  );
  assert.ok(
    result.observations.some(
      (obs) =>
        obs.metricId === PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID &&
        obs.referencePeriod === '2023',
    ),
  );
});
