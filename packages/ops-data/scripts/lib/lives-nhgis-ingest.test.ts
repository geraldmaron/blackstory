import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LivesPublishedObservation } from '../../src/lives/published-observation.ts';
import { livesSeriesForObservations, summarizeLivesObservations } from './lives-nhgis-ingest.ts';

function observation(
  overrides: Partial<LivesPublishedObservation> = {},
): LivesPublishedObservation {
  return {
    id: 'obs:lives-homeownership:state:48:1990:black',
    metricId: 'lives-homeownership',
    jurisdictionId: 'state:48',
    boundaryVersion: 'state-1990',
    referencePeriod: '1990',
    datasetVintage: '1990 Census Summary Tape File 2B (100-percent data)',
    estimate: 45,
    marginOfError: null,
    numerator: 45,
    denominator: 100,
    raceEthnicitySlice: 'black',
    source: 'Census Bureau, 1990 Census Summary Tape File 2B, table "Tenure", via IPUMS NHGIS',
    sourceUrl: 'https://www.census.gov/data/datasets/1990/dec/summary-file-2.html',
    contentHash: 'hash',
    metadata: { table: 'Tenure' },
    ...overrides,
  };
}

test('series rows come once per metric', () => {
  const series = livesSeriesForObservations([
    observation(),
    observation({ id: 'obs:lives-homeownership:state:01:1990:black', jurisdictionId: 'state:01' }),
  ]);
  assert.deepEqual(
    series.map((row) => row.metric_id),
    ['lives-homeownership'],
  );
});

test('a duplicate id, a source without a web link, or an unknown metric stops the load', () => {
  assert.throws(() => livesSeriesForObservations([observation(), observation()]), /duplicate/);
  assert.throws(
    () => livesSeriesForObservations([observation({ sourceUrl: 'PENDING' })]),
    /sources without a web link/,
  );
  assert.throws(
    () => livesSeriesForObservations([observation({ metricId: 'lives-unknown' })]),
    /no series definition/,
  );
});

test('the run report counts brackets together and lists national figures', () => {
  const report = summarizeLivesObservations([
    observation(),
    observation({
      id: 'obs:lives-income-bracket-0-5000:nation:US:1990:black',
      metricId: 'lives-income-bracket-0-5000',
      jurisdictionId: 'nation:US',
    }),
    observation({
      id: 'obs:lives-homeownership:nation:US:1990:black',
      jurisdictionId: 'nation:US',
    }),
  ]);
  assert.deepEqual(report.byMetric, {
    '1990 lives-homeownership': 2,
    '1990 lives-income-bracket-*': 1,
  });
  assert.deepEqual(report.national, ['1990 lives-homeownership black: 45']);
});
