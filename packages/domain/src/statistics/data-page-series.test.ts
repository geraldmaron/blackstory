/** Tests for `/data` indicator series fixture bundle and observation merge. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DATA_PAGE_INDICATOR_FIXTURE_BUNDLE,
  mergeDataPageIndicatorBundle,
} from './data-page-series.js';

test('fixture bundle carries five chart compositions with theme links', () => {
  const bundle = DATA_PAGE_INDICATOR_FIXTURE_BUNDLE;
  assert.equal(bundle.wealthComparison.themeId, 'redlining');
  assert.equal(bundle.imprisonmentComparison.themeId, 'drug_policy_state');
  assert.equal(bundle.federalDrugSentences.points.length, 3);
  assert.equal(bundle.hmdaDenialRates.points[0]?.values.black, 10.9);
  assert.equal(bundle.cookHomeownership.points[2]?.values.white, 67.2);
});

test('mergeDataPageIndicatorBundle overlays warehouse observations when present', () => {
  const merged = mergeDataPageIndicatorBundle(DATA_PAGE_INDICATOR_FIXTURE_BUNDLE, [
    {
      metricId: 'scf-median-wealth-black-nation',
      jurisdictionId: 'nation:US',
      referencePeriod: '2022',
      estimate: 50_000,
      source: 'fed-survey-consumer-finances',
      sourceUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
    },
    {
      metricId: 'scf-median-wealth-white-nation',
      jurisdictionId: 'nation:US',
      referencePeriod: '2022',
      estimate: 300_000,
      source: 'fed-survey-consumer-finances',
      sourceUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
    },
  ]);
  assert.equal(merged.servedFrom, 'postgres');
  assert.equal(merged.wealthComparison.primary.value, 50_000);
  assert.equal(merged.wealthComparison.comparison.value, 300_000);
  assert.equal(merged.wealthComparison.ratioValue, 6);
});
