/** Tests for `/data` indicator series fixture bundle and observation merge. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DATA_PAGE_INDICATOR_FIXTURE_BUNDLE,
  mergeDataPageIndicatorBundle,
  type DataPageObservationRow,
} from './data-page-series.js';

function scfRow(
  metricId: string,
  referencePeriod: string,
  estimate: number,
): DataPageObservationRow {
  return {
    metricId,
    jurisdictionId: 'nation:US',
    referencePeriod,
    estimate,
    source: 'fed-survey-consumer-finances',
    sourceUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
  };
}

test('fixture bundle carries chart compositions with chapter theme links', () => {
  const bundle = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE;
  assert.equal(bundle.wealthComparison.themeId, 'wealth_gap');
  assert.equal(bundle.wealthComparison.referencePeriod, '2022');
  assert.equal(bundle.imprisonmentComparison.themeId, 'drug_policy_state');
  assert.equal(bundle.imprisonmentComparison.referencePeriod, '2023');
  assert.equal(bundle.federalDrugSentences.points.length, 3);
  assert.equal(bundle.hmdaDenialRates.points.at(-1)?.values.black, 39);
  assert.equal(bundle.cookHomeownership.points[2]?.values.white, 67.2);
});

test('fixture wealth trend covers every SCF wave from 1989 through 2022', () => {
  const trend = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthTrend;
  if (trend === undefined) throw new Error('wealthTrend fixture missing');
  assert.equal(trend.points.length, 12);
  assert.equal(trend.points[0]?.period, '1989');
  assert.equal(trend.points.at(-1)?.period, '2022');
  assert.equal(trend.points.at(-1)?.values.black, 44_900);
  assert.equal(trend.points.at(-1)?.values.white, 285_000);
});

test('mergeDataPageIndicatorBundle overlays warehouse observations when present', () => {
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    scfRow('scf-median-wealth-black-nation', '2022', 50_000),
    scfRow('scf-median-wealth-white-nation', '2022', 300_000),
  ]);
  assert.equal(merged.servedFrom, 'postgres');
  assert.equal(merged.wealthComparison.primary.value, 50_000);
  assert.equal(merged.wealthComparison.comparison.value, 300_000);
  assert.equal(merged.wealthComparison.ratioValue, 6);
});

test('race-pair merge picks the latest shared period, not warehouse row order', () => {
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    scfRow('scf-median-wealth-black-nation', '1989', 9_200),
    scfRow('scf-median-wealth-white-nation', '1989', 164_030),
    scfRow('scf-median-wealth-black-nation', '2022', 44_900),
    scfRow('scf-median-wealth-white-nation', '2022', 285_000),
  ]);
  assert.equal(merged.wealthComparison.referencePeriod, '2022');
  assert.equal(merged.wealthComparison.primary.value, 44_900);
  assert.equal(merged.wealthComparison.ratioValue, 6.3);
});

test('race-pair merge skips a newer period missing one side of the pair', () => {
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    scfRow('scf-median-wealth-black-nation', '2019', 27_970),
    scfRow('scf-median-wealth-white-nation', '2019', 218_140),
    scfRow('scf-median-wealth-black-nation', '2022', 44_900),
  ]);
  assert.equal(merged.wealthComparison.referencePeriod, '2019');
  assert.equal(merged.wealthComparison.comparison.value, 218_140);
});

test('wealth trend merge rebuilds points from shared SCF periods', () => {
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    scfRow('scf-median-wealth-black-nation', '2019', 27_970),
    scfRow('scf-median-wealth-white-nation', '2019', 218_140),
    scfRow('scf-median-wealth-black-nation', '2022', 44_900),
    scfRow('scf-median-wealth-white-nation', '2022', 285_000),
  ]);
  const mergedTrend = merged.wealthTrend;
  if (mergedTrend === undefined) throw new Error('merged wealthTrend missing');
  assert.deepEqual(
    mergedTrend.points.map((point) => point.period),
    ['2019', '2022'],
  );
  assert.equal(mergedTrend.points[1]?.values.white, 285_000);
});

test('cost burden merge stays pinned to the suburban Cook 2016-2020 vintage', () => {
  const chasRow = (metricId: string, referencePeriod: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'county:17031',
    referencePeriod,
    estimate,
    source: 'hud-chas',
    sourceUrl: 'https://www.huduser.gov/portal/datasets/cp.html',
  });
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    chasRow('hud-chas-cost-burden-black-county', '2016-2020', 44.6),
    chasRow('hud-chas-cost-burden-white-county', '2016-2020', 31.3),
    chasRow('hud-chas-cost-burden-black-county', '2017-2021', 55.5),
    chasRow('hud-chas-cost-burden-white-county', '2017-2021', 26),
  ]);
  assert.equal(merged.costBurdenComparison.primary.value, 44.6);
  assert.equal(merged.costBurdenComparison.comparison.value, 31.3);
  assert.equal(merged.costBurdenComparison.referencePeriod, '2016–2020 ACS');
});
