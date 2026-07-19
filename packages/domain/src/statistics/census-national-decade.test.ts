import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CENSUS_NATIONAL_BLACK_POPULATION_SERIES,
  CENSUS_NATIONAL_ENSLAVED_BLACK_POPULATION_SERIES,
  CENSUS_NATIONAL_FREE_BLACK_POPULATION_SERIES,
  CENSUS_NATIONAL_TOTAL_POPULATION_SERIES,
  blackShareOfTotalPct,
  censusNationalDecadeToObservations,
  computeNationalPopulationChanges,
  freeEnslavedTotalDiscrepancy,
  type NationalPopulationTimelineRow,
} from './census-national-decade.js';

// Real twps0056 Table 1 values (public domain) — safe spot-check fixtures.
const ROW_1790 = {
  decade: '1790',
  totalPopulation: 3_929_214,
  blackPopulation: 757_208,
  freeBlackPopulation: 59_527,
  enslavedBlackPopulation: 697_681,
  source: 'us-census-historical-race-1790-1990',
  contentHash: 'hash-1790',
  retrievedAt: '2026-07-19T00:00:00.000Z',
} as const;

test('emits total + black observations, plus free/enslaved only when split present', () => {
  const withSplit = censusNationalDecadeToObservations(ROW_1790);
  const series = withSplit.map((o) => o.seriesId).sort();
  assert.deepEqual(
    series,
    [
      CENSUS_NATIONAL_BLACK_POPULATION_SERIES.metricId,
      CENSUS_NATIONAL_ENSLAVED_BLACK_POPULATION_SERIES.metricId,
      CENSUS_NATIONAL_FREE_BLACK_POPULATION_SERIES.metricId,
      CENSUS_NATIONAL_TOTAL_POPULATION_SERIES.metricId,
    ].sort(),
  );
  for (const obs of withSplit) {
    assert.equal(obs.status, 'observed');
    assert.equal(obs.jurisdictionId, 'us');
    assert.equal(obs.boundaryVersion, 'nation-1790');
    assert.equal(obs.referencePeriod, '1790');
  }

  const noSplit = censusNationalDecadeToObservations({
    decade: '1900',
    totalPopulation: 75_994_575,
    blackPopulation: 8_833_994,
    source: 's',
    contentHash: 'h',
    retrievedAt: ROW_1790.retrievedAt,
  });
  assert.equal(noSplit.length, 2, 'post-1860 decades have no free/enslaved sub-series');
});

test('free + enslaved reconstitutes the Black total within rounding; null when no split', () => {
  assert.equal(freeEnslavedTotalDiscrepancy(ROW_1790), 0);
  assert.equal(
    freeEnslavedTotalDiscrepancy({ blackPopulation: 8_833_994 }),
    null,
    'no split → nothing to reconcile',
  );
});

test('blackShareOfTotalPct guards a zero denominator', () => {
  assert.equal(blackShareOfTotalPct(0, 0), null);
  const share = blackShareOfTotalPct(757_208, 3_929_214)!;
  assert.ok(Math.abs(share - 19.27) < 0.05, `1790 Black share ≈ 19.3%, got ${share}`);
});

function timelineRow(
  partial: Pick<
    NationalPopulationTimelineRow,
    'decade' | 'year' | 'totalPopulation' | 'blackPopulation'
  >,
): NationalPopulationTimelineRow {
  return {
    freeBlackPopulation: null,
    enslavedBlackPopulation: null,
    blackShareOfTotalPct: blackShareOfTotalPct(partial.blackPopulation, partial.totalPopulation),
    raceCategoryLabel: 'Black',
    nationalSource: 'twps0056',
    sourceId: 'us-census-historical-race-1790-1990',
    sourceUrl: 'https://example',
    opensDefinitionBoundary: partial.decade === '2000',
    southernUndercountCaveat: false,
    hasFreeEnslavedSplit: false,
    ...partial,
  };
}

test('adjacent-decade changes flag the 1990→2000 boundary and skip non-adjacent gaps', () => {
  const rows = [
    timelineRow({
      decade: '1980',
      year: 1980,
      totalPopulation: 226_545_805,
      blackPopulation: 26_495_025,
    }),
    timelineRow({
      decade: '1990',
      year: 1990,
      totalPopulation: 248_709_873,
      blackPopulation: 29_986_060,
    }),
    timelineRow({
      decade: '2000',
      year: 2000,
      totalPopulation: 281_421_906,
      blackPopulation: 34_658_190,
    }),
    // Deliberate gap: no 2010 row, then 2020 — must NOT yield a 2000→2020 change record.
    timelineRow({
      decade: '2020',
      year: 2020,
      totalPopulation: 331_449_281,
      blackPopulation: 41_104_200,
    }),
  ];
  const changes = computeNationalPopulationChanges(rows);
  assert.deepEqual(
    changes.map((c) => `${c.fromDecade}->${c.toDecade}`),
    ['1980->1990', '1990->2000'],
    'gap between 2000 and 2020 produces no spurious delta',
  );
  const boundary = changes.find((c) => c.toDecade === '2000')!;
  assert.equal(boundary.crossesDefinitionBoundary, true);
  const clean = changes.find((c) => c.toDecade === '1990')!;
  assert.equal(clean.crossesDefinitionBoundary, false);
  assert.equal(clean.growth.absoluteChange, 29_986_060 - 26_495_025);
});
