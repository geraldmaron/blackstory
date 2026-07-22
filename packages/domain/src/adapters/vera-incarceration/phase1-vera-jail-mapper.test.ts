/**
 * Tests for Phase 1 Vera county jail rate CSV parsing and observation mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID } from './constants.js';
import { fetchPhase1VeraJailCountyObservations } from './fetch-phase1-vera-jail.js';
import {
  mapVeraCountyJailRowsToObservations,
  parseVeraCountyJailCsv,
  selectVeraCountyJailRows,
} from './phase1-vera-jail-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(
  join(__dirname, '../../../../firebase/fixtures/reference-indicators/vera-county-snippet.csv'),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseVeraCountyJailCsv reads Montgomery County MD 2018 jail rate', () => {
  const { rows } = parseVeraCountyJailCsv(SAMPLE_CSV);
  const md = rows.find((row) => row.countyFips === '24031' && row.year === 2018);
  assert.ok(md);
  assert.equal(md?.jailRate, 110.41);
});

test('selectVeraCountyJailRows filters by state and year', () => {
  const { rows } = parseVeraCountyJailCsv(SAMPLE_CSV);
  const selected = selectVeraCountyJailRows({
    rows,
    stateFipsList: ['24'],
    referenceYear: 2018,
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.countyFips, '24031');
});

test('mapVeraCountyJailRowsToObservations builds catalog-aligned draft', () => {
  const { rows } = parseVeraCountyJailCsv(SAMPLE_CSV);
  const mdRow = rows.find((row) => row.countyFips === '24031' && row.year === 2018);
  assert.ok(mdRow);
  const [observation] = mapVeraCountyJailRowsToObservations([mdRow!], RETRIEVED_AT);
  assert.ok(observation);
  assert.equal(observation?.metricId, PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID);
  assert.equal(observation?.id, 'obs:vera-jail-population-rate-county:county:24031:2018');
  assert.equal(observation?.source, 'vera-incarceration-trends');
});

test('fetchPhase1VeraJailCountyObservations supports offline csvText', async () => {
  const result = await fetchPhase1VeraJailCountyObservations({
    csvText: SAMPLE_CSV,
    stateFipsList: ['24'],
    referenceYear: 2018,
  });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.estimate, 110.41);
});
