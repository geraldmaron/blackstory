/**
 * Tests for Phase 1 BJS NPS stat01 parsing and imprisonment-rate mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID,
  PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID,
} from './constants.js';
import {
  mapBjsNpsRowsToObservations,
  parseBjsNpsStat01Csv,
} from './phase1-bjs-nps-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators/bjs-nps-p23stat01-snippet.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseBjsNpsStat01Csv extracts Maryland 2023 race counts', () => {
  const { rows, referenceYear } = parseBjsNpsStat01Csv(SAMPLE_CSV);
  assert.equal(referenceYear, 2023);
  const md = rows.find((row) => row.stateFips === '24');
  assert.ok(md);
  assert.equal(md?.blackPrisoners, 11_651);
  assert.equal(md?.whitePrisoners, 3_476);
});

test('mapBjsNpsRowsToObservations computes Maryland imprisonment rates', () => {
  const { rows } = parseBjsNpsStat01Csv(SAMPLE_CSV);
  const populations = new Map([
    [
      '24',
      {
        stateFips: '24',
        blackPopulation: 1_220_000,
        whitePopulation: 3_300_000,
      },
    ],
  ]);
  const observations = mapBjsNpsRowsToObservations(rows, populations, RETRIEVED_AT);
  const black = observations.find(
    (obs) =>
      obs.metricId === PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID &&
      obs.jurisdictionId === 'state:24',
  );
  const white = observations.find(
    (obs) =>
      obs.metricId === PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID &&
      obs.jurisdictionId === 'state:24',
  );
  assert.ok(black);
  assert.ok(white);
  assert.equal(black?.estimate, 955);
  assert.equal(white?.estimate, 105);
  assert.equal(black?.referencePeriod, '2023');
});
