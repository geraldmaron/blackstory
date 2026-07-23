/**
 * Tests for Phase 1 USSC Quick Facts drug sentencing fixture parsing and observation mapping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PHASE1_USSC_AVERAGE_SENTENCE_CRACK_NATION_METRIC_ID,
  PHASE1_USSC_AVERAGE_SENTENCE_POWDER_NATION_METRIC_ID,
  PHASE1_USSC_BLACK_SHARE_CRACK_OFFENDERS_NATION_METRIC_ID,
  PHASE1_USSC_NATION_JURISDICTION_ID,
} from './constants.js';
import {
  mapUsscQuickFactsRowsToObservations,
  parseUsscQuickFactsDrugFixtureCsv,
} from './phase1-ussc-quick-facts-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = readFileSync(
  join(
    __dirname,
    '../../../../firebase/fixtures/reference-indicators/ussc-quick-facts-drug-sentencing-fy2013-2023.csv',
  ),
  'utf8',
);
const RETRIEVED_AT = '2026-07-22T00:00:00.000Z';

test('parseUsscQuickFactsDrugFixtureCsv loads FY2013–FY2023 rows', () => {
  const { rows, rejected } = parseUsscQuickFactsDrugFixtureCsv(FIXTURE_CSV);
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 10);
  assert.deepEqual(
    rows.map((row) => row.fiscalYear),
    [2013, 2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
  );
});

test('parseUsscQuickFactsDrugFixtureCsv matches FY2023 Quick Facts averages', () => {
  const { rows } = parseUsscQuickFactsDrugFixtureCsv(FIXTURE_CSV);
  const fy2023 = rows.find((row) => row.fiscalYear === 2023);
  assert.ok(fy2023);
  assert.equal(fy2023?.crackAverageSentenceMonths, 60);
  assert.equal(fy2023?.powderAverageSentenceMonths, 68);
  assert.equal(fy2023?.crackBlackSharePct, 78.9);
});

test('mapUsscQuickFactsRowsToObservations emits nation observations with provenance quartet', () => {
  const { rows } = parseUsscQuickFactsDrugFixtureCsv(FIXTURE_CSV);
  const observations = mapUsscQuickFactsRowsToObservations(rows, RETRIEVED_AT);

  const crack2023 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_USSC_AVERAGE_SENTENCE_CRACK_NATION_METRIC_ID &&
      obs.referencePeriod === '2023',
  );
  const powder2023 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_USSC_AVERAGE_SENTENCE_POWDER_NATION_METRIC_ID &&
      obs.referencePeriod === '2023',
  );
  const blackShare2023 = observations.find(
    (obs) =>
      obs.metricId === PHASE1_USSC_BLACK_SHARE_CRACK_OFFENDERS_NATION_METRIC_ID &&
      obs.referencePeriod === '2023',
  );

  assert.ok(crack2023);
  assert.ok(powder2023);
  assert.ok(blackShare2023);
  assert.equal(crack2023?.jurisdictionId, PHASE1_USSC_NATION_JURISDICTION_ID);
  assert.equal(crack2023?.estimate, 60);
  assert.equal(powder2023?.estimate, 68);
  assert.equal(blackShare2023?.estimate, 78.9);
  assert.equal(crack2023?.source, 'ussc-quick-facts-drug');
  assert.match(
    crack2023?.sourceUrl ?? '',
    /^https:\/\/www\.ussc\.gov\/sites\/default\/files\/pdf\/research-and-publications\/quick-facts\/Crack_Cocaine_FY23\.pdf$/,
  );
  assert.equal(crack2023?.retrievedAt, RETRIEVED_AT);
  assert.match(crack2023?.contentHash ?? '', /^[a-f0-9]{64}$/);
  assert.equal(crack2023?.id, 'obs:ussc-average-sentence-months-crack-nation:nation:US:2023');
});

test('mapUsscQuickFactsRowsToObservations counts all metric slots in fixture', () => {
  const { rows } = parseUsscQuickFactsDrugFixtureCsv(FIXTURE_CSV);
  const observations = mapUsscQuickFactsRowsToObservations(rows, RETRIEVED_AT);
  // 10 crack + 9 powder + 7 black share = 26
  assert.equal(observations.length, 26);
});
