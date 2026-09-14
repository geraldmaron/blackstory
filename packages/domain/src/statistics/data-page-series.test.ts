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

test('fixture wealth ratio long arc covers every DKKS benchmark year, 1860 through 2019', () => {
  const longArc = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthRatioLongArc;
  if (longArc === undefined) throw new Error('wealthRatioLongArc fixture missing');
  assert.equal(longArc.points.length, 32);
  assert.equal(longArc.points[0]?.period, '1860');
  assert.equal(longArc.points[0]?.values.ratio, 56.3);
  assert.equal(longArc.points.at(-1)?.period, '2019');
  assert.equal(longArc.points.at(-1)?.values.ratio, 6.6);
  // 1929 carries no white per-capita estimate in the source, so no ratio: it is skipped
  // rather than defaulted to zero, which would draw a fabricated dip to nothing.
  assert.ok(longArc.points.every((point) => point.period !== '1929'));
});

test('fixture national homeownership long arc covers 1900 through 2024, decennial then ACS', () => {
  const longArc = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.nationalHomeownershipLongArc;
  if (longArc === undefined) throw new Error('nationalHomeownershipLongArc fixture missing');
  assert.equal(longArc.points.length, 30);
  assert.equal(longArc.points[0]?.period, '1900');
  assert.equal(longArc.points[0]?.values.black, 21.3);
  assert.equal(longArc.points[10]?.period, '2000');
  assert.equal(longArc.points[11]?.period, '2005');
  // No standard one-year ACS estimate was published for 2020: a real gap, not filled in.
  assert.ok(longArc.points.every((point) => point.period !== '2020'));
  assert.equal(longArc.points.at(-1)?.period, '2024');
  assert.equal(longArc.points.at(-1)?.values.white_nh, 74);
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

test('cook homeownership merge appends the ACS point after the decennial series', () => {
  const cookRow = (metricId: string, referencePeriod: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'county:17031',
    referencePeriod,
    estimate,
    source: 'nhgis-county-race',
    sourceUrl: 'https://www.nhgis.org/citing-nhgis',
  });
  const acsRow = (metricId: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'county:17031',
    referencePeriod: '2020-2024',
    estimate,
    source: 'acs-census-api',
    sourceUrl: 'https://www.census.gov/programs-surveys/acs',
  });
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    cookRow('nhgis-homeownership-rate-black-county', '1990', 37.1),
    cookRow('nhgis-homeownership-rate-white-county', '1990', 63.8),
    cookRow('nhgis-homeownership-rate-black-county', '2010', 41.2),
    cookRow('nhgis-homeownership-rate-white-county', '2010', 67.2),
    acsRow('acs-homeownership-rate-black-county', 41.5),
    acsRow('acs-homeownership-rate-white_nh-county', 67.2),
  ]);
  assert.deepEqual(
    merged.cookHomeownership.points.map((point) => point.period),
    ['1990', '2010', '2020-2024 (ACS)'],
  );
  const acsPoint = merged.cookHomeownership.points.at(-1);
  assert.equal(acsPoint?.values.black, 41.5);
  assert.equal(acsPoint?.values.white, 67.2);
});

test('cook homeownership merge omits the ACS point when only decennial rows are present', () => {
  const cookRow = (metricId: string, referencePeriod: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'county:17031',
    referencePeriod,
    estimate,
    source: 'nhgis-county-race',
    sourceUrl: 'https://www.nhgis.org/citing-nhgis',
  });
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    cookRow('nhgis-homeownership-rate-black-county', '1990', 37.1),
    cookRow('nhgis-homeownership-rate-white-county', '1990', 63.8),
  ]);
  assert.deepEqual(
    merged.cookHomeownership.points.map((point) => point.period),
    ['1990'],
  );
});

test('wealth ratio long arc merge overlays warehouse benchmark years verbatim', () => {
  const ratioRow = (referencePeriod: string, estimate: number): DataPageObservationRow => ({
    metricId: 'dkks-wealth-ratio-white-black-nation',
    jurisdictionId: 'nation:US',
    referencePeriod,
    estimate,
    source: 'derenoncourt-wealth-of-two-nations',
    sourceUrl: 'https://www.elloraderenoncourt.com/us-inequality-data',
  });
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    ratioRow('1860', 56.3),
    ratioRow('2019', 6.6),
  ]);
  const longArc = merged.wealthRatioLongArc;
  if (longArc === undefined) throw new Error('merged wealthRatioLongArc missing');
  assert.deepEqual(
    longArc.points.map((point) => point.period),
    ['1860', '2019'],
  );
  assert.equal(longArc.points[1]?.values.ratio, 6.6);
});

test('wealth ratio long arc merge leaves the fixture untouched when no warehouse rows match', () => {
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    scfRow('scf-median-wealth-black-nation', '2022', 44_900),
  ]);
  assert.equal(
    merged.wealthRatioLongArc?.points.length,
    DATA_PAGE_INDICATOR_FIXTURE_BUNDLE.wealthRatioLongArc?.points.length,
  );
});

test('national homeownership long arc merge concatenates decennial and ACS rows in order', () => {
  const decRow = (referencePeriod: string, metricId: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'nation:US',
    referencePeriod,
    estimate,
    source: 'census-historical-housing-tables',
    sourceUrl: 'https://www.census.gov/topics/housing/homeownership/data/historical.html',
  });
  const acsRow = (referencePeriod: string, metricId: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'nation:US',
    referencePeriod,
    estimate,
    source: 'acs-census-api',
    sourceUrl: 'https://www.census.gov/programs-surveys/acs',
  });
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    decRow('1900', 'census-decennial-homeownership-black-nation', 21.3),
    decRow('1900', 'census-decennial-homeownership-white_nh-nation', 48.5),
    decRow('2000', 'census-decennial-homeownership-black-nation', 46.3),
    decRow('2000', 'census-decennial-homeownership-white_nh-nation', 73.1),
    acsRow('2024', 'acs-homeownership-rate-black-nation', 45.4),
    acsRow('2024', 'acs-homeownership-rate-white_nh-nation', 74),
  ]);
  const longArc = merged.nationalHomeownershipLongArc;
  if (longArc === undefined) throw new Error('merged nationalHomeownershipLongArc missing');
  assert.deepEqual(
    longArc.points.map((point) => point.period),
    ['1900', '2000', '2024'],
  );
  assert.equal(longArc.points[2]?.values.black, 45.4);
  assert.equal(longArc.points[2]?.values.white_nh, 74);
});

test('national homeownership long arc merge skips a decennial period missing one race side', () => {
  const decRow = (referencePeriod: string, metricId: string, estimate: number) => ({
    metricId,
    jurisdictionId: 'nation:US',
    referencePeriod,
    estimate,
    source: 'census-historical-housing-tables',
    sourceUrl: 'https://www.census.gov/topics/housing/homeownership/data/historical.html',
  });
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    decRow('1900', 'census-decennial-homeownership-black-nation', 21.3),
    decRow('1900', 'census-decennial-homeownership-white_nh-nation', 48.5),
    // 1910 carries only the Black side: it must not appear with a fabricated white_nh of 0.
    decRow('1910', 'census-decennial-homeownership-black-nation', 22.5),
  ]);
  const longArc = merged.nationalHomeownershipLongArc;
  if (longArc === undefined) throw new Error('merged nationalHomeownershipLongArc missing');
  assert.deepEqual(
    longArc.points.map((point) => point.period),
    ['1900'],
  );
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
  assert.equal(merged.costBurdenComparison.referencePeriod, '2016 to 2020 ACS');
});
