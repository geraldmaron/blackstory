/**
 * Tests for Phase 1 Eviction Lab county CSV parsing and observation mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  EVICTION_LAB_ATTRIBUTION_NOTE,
  EVICTION_LAB_DATA_FOR_ANALYSIS_URL,
  PHASE1_EVICTION_FILING_RATE_METRIC_ID,
} from './constants.js';
import { fetchPhase1EvictionCountyObservations } from './fetch-phase1-eviction.js';
import {
  filterPhase1EvictionRowsByStates,
  mapPhase1EvictionRowsToObservations,
  parsePhase1EvictionCountyCsv,
} from './phase1-eviction-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators/eviction-lab-county-proprietary-sample.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parsePhase1EvictionCountyCsv keeps observed rows and rejects estimated/malformed', () => {
  const { rows, rejected } = parsePhase1EvictionCountyCsv(SAMPLE_CSV);
  assert.equal(rows.length, 3);
  assert.ok(rejected.some((line) => line.includes('non-observed')));
  assert.ok(rejected.some((line) => line.includes('99999')));
  assert.deepEqual(
    rows.map((row) => `${row.cofips}:${row.year}`),
    ['13121:2016', '24033:2016', '13001:2016'],
  );
});

test('filterPhase1EvictionRowsByStates bounds to requested state FIPS', () => {
  const { rows } = parsePhase1EvictionCountyCsv(SAMPLE_CSV);
  const gaOnly = filterPhase1EvictionRowsByStates(rows, ['13']);
  assert.equal(gaOnly.length, 2);
  const mdOnly = filterPhase1EvictionRowsByStates(rows, ['24']);
  assert.equal(mdOnly.length, 1);
  assert.equal(mdOnly[0]?.cofips, '24033');
});

test('mapPhase1EvictionRowsToObservations emits attribution-required provenance', () => {
  const { rows } = parsePhase1EvictionCountyCsv(SAMPLE_CSV);
  const fulton = rows.find((row) => row.cofips === '13121');
  assert.ok(fulton);
  const [draft] = mapPhase1EvictionRowsToObservations([fulton!], RETRIEVED_AT);
  assert.equal(draft.metricId, PHASE1_EVICTION_FILING_RATE_METRIC_ID);
  assert.equal(draft.jurisdictionId, 'county:13121');
  assert.equal(draft.referencePeriod, '2016');
  assert.equal(draft.estimate, 18.7);
  assert.equal(draft.source, 'eviction-lab');
  assert.equal(draft.sourceUrl, EVICTION_LAB_DATA_FOR_ANALYSIS_URL);
  assert.equal(draft.attributionNote, EVICTION_LAB_ATTRIBUTION_NOTE);
  assert.equal(draft.coverageType, 'observed');
  assert.match(draft.id, /^obs:eviction-filing-rate-county:county:13121:2016$/);
  assert.match(draft.contentHash, /^[a-f0-9]{64}$/);
});

test('fetchPhase1EvictionCountyObservations uses fixture csvText without network', async () => {
  const result = await fetchPhase1EvictionCountyObservations(['13', '24'], {
    csvText: SAMPLE_CSV,
    retrievedAt: RETRIEVED_AT,
    fetchImpl: async () => {
      throw new Error('network should not be called when csvText is provided');
    },
  });
  assert.equal(result.rowsObserved, 3);
  assert.equal(result.observations.length, 3);
  assert.ok(result.observations.every((obs) => obs.source === 'eviction-lab'));
});
