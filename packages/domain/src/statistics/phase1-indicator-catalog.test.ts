/** Tests for Phase 1 indicator catalog vocabulary. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PHASE1_INDICATOR_CATALOG,
  getPhase1Indicator,
  listPhase1IndicatorsByTheme,
  summarizePhase1IndicatorCatalog,
} from './phase1-indicator-catalog.js';

test('Phase 1 catalog has unique metric ids and required series fields', () => {
  const ids = PHASE1_INDICATOR_CATALOG.map((row) => row.metricId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PHASE1_INDICATOR_CATALOG.length >= 12);
  for (const row of PHASE1_INDICATOR_CATALOG) {
    assert.ok(row.metricDefinition.length > 0);
    assert.ok(row.externalDataSourceId.length > 0);
    assert.ok(row.sourceDataset.length > 0);
  }
});

test('justice and wealth themes include imprisonment and SCF metrics', () => {
  assert.ok(getPhase1Indicator('imprisonment-rate-black-state'));
  assert.ok(getPhase1Indicator('scf-median-wealth-black-nation'));
  assert.ok(listPhase1IndicatorsByTheme('justice').length >= 2);
  assert.ok(listPhase1IndicatorsByTheme('wealth').length >= 3);
});

test('summarizePhase1IndicatorCatalog reports counts', () => {
  const summary = summarizePhase1IndicatorCatalog();
  assert.equal(summary.metricCount, PHASE1_INDICATOR_CATALOG.length);
  assert.ok(summary.themes.includes('justice'));
  assert.ok(summary.metrics.some((m) => m.metricId === 'eviction-filing-rate-county'));
});
