/**
 * Unit tests for EPA TRI county facility-count mapper — fixture CSV only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  EPA_TRI_AGGREGATE_STRATEGY_NOTE,
  PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID,
} from './constants.js';
import {
  aggregateTriFacilityCounts,
  mapTriFacilityCountsToObservations,
  parseTriFacilityCsv,
} from './phase1-tri-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators/tri-il-counties-sample.csv',
);

test('parseTriFacilityCsv loads distinct facility rows for IL pilot counties', () => {
  const parsed = parseTriFacilityCsv(readFileSync(FIXTURE_PATH, 'utf8'), ['17031', '17043', '17097']);
  assert.equal(parsed.rejected.length, 0);
  assert.equal(parsed.rows.length, 28);
});

test('aggregateTriFacilityCounts deduplicates facilities by county-year', () => {
  const parsed = parseTriFacilityCsv(readFileSync(FIXTURE_PATH, 'utf8'), ['17031']);
  const counts = aggregateTriFacilityCounts(parsed.rows);
  assert.equal(counts.get('17031:2023'), 12);
  assert.equal(counts.get('17031:2022'), 11);
});

test('mapTriFacilityCountsToObservations emits county facility-count drafts', () => {
  const parsed = parseTriFacilityCsv(readFileSync(FIXTURE_PATH, 'utf8'), ['17031']);
  const counts = aggregateTriFacilityCounts(parsed.rows);
  const observations = mapTriFacilityCountsToObservations(counts, '2026-01-01T00:00:00.000Z');
  const cook2023 = observations.find(
    (obs) => obs.jurisdictionId === 'county:17031' && obs.referencePeriod === '2023',
  );
  assert.ok(cook2023);
  assert.equal(cook2023.metricId, PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID);
  assert.equal(cook2023.estimate, 12);
  assert.equal(cook2023.facilityCount, 12);
  assert.equal(cook2023.source, 'epa-tri');
  assert.equal(cook2023.methodologyNote, EPA_TRI_AGGREGATE_STRATEGY_NOTE);
  assert.match(cook2023.methodologyNote, /not ambient toxicity/i);
});
