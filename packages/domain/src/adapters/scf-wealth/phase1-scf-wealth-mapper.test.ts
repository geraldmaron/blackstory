/**
 * Tests for Phase 1 SCF median wealth fixture parsing and observation mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID,
  PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID,
  PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID,
} from './constants.js';
import {
  mapScfWealthRowsToObservations,
  parseScfMedianWealthFixtureCsv,
} from './phase1-scf-wealth-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators/scf-median-net-worth-by-race-1989-2022.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseScfMedianWealthFixtureCsv loads triennial 1989–2022 rows', () => {
  const { rows, rejected } = parseScfMedianWealthFixtureCsv(FIXTURE_CSV);
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 12);
  assert.deepEqual(
    rows.map((row) => row.referenceYear),
    [1989, 1992, 1995, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022],
  );
});

test('parseScfMedianWealthFixtureCsv matches 2022 bulletin medians', () => {
  const { rows } = parseScfMedianWealthFixtureCsv(FIXTURE_CSV);
  const y2022 = rows.find((row) => row.referenceYear === 2022);
  assert.ok(y2022);
  assert.equal(y2022?.blackMedianUsd, 44_900);
  assert.equal(y2022?.whiteMedianUsd, 285_000);
});

test('mapScfWealthRowsToObservations emits nation observations with provenance quartet', () => {
  const { rows } = parseScfMedianWealthFixtureCsv(FIXTURE_CSV);
  const observations = mapScfWealthRowsToObservations(rows, RETRIEVED_AT);
  assert.equal(observations.length, 24);

  const black2022 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID &&
      obs.referencePeriod === '2022',
  );
  const white2022 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID &&
      obs.referencePeriod === '2022',
  );

  assert.ok(black2022);
  assert.ok(white2022);
  assert.equal(black2022?.jurisdictionId, PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID);
  assert.equal(black2022?.estimate, 44_900);
  assert.equal(white2022?.estimate, 285_000);
  assert.equal(black2022?.source, 'fed-survey-consumer-finances');
  assert.match(black2022?.sourceUrl ?? '', /^https:\/\/www\.federalreserve\.gov\//);
  assert.equal(black2022?.retrievedAt, RETRIEVED_AT);
  assert.match(black2022?.contentHash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(black2022?.id, 'obs:scf-median-wealth-black-nation:nation:US:2022');
});
