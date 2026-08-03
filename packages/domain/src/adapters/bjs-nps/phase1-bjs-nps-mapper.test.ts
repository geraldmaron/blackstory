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
import { mapBjsNpsRowsToObservations, parseBjsNpsStat01Csv } from './phase1-bjs-nps-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../ops-data/fixtures/reference-indicators/bjs-nps-p23stat01-snippet.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseBjsNpsStat01Csv reads Prisoners in 2020 Appendix table 2 state counts', () => {
  const csv = readFileSync(
    join(
      __dirname,
      '../../../../ops-data/fixtures/reference-indicators/bjs-nps-p20stat02-full.csv',
    ),
    'utf8',
  );
  const { rows, referenceYear } = parseBjsNpsStat01Csv(csv);
  assert.equal(referenceYear, 2020);
  const il = rows.find((row) => row.stateFips === '17');
  assert.ok(il);
  assert.equal(il?.blackPrisoners, 15_866);
  assert.equal(il?.whitePrisoners, 9_271);
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
