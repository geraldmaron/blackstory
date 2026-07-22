/**
 * Phase 1 EJI/TRI indicator catalog tests — unique metric ids and environment theme.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  listPhase1EjiTriIndicators,
  PHASE1_EJI_TRI_INDICATOR_DEFINITIONS,
} from './phase1-eji-tri-indicator-catalog.js';

test('EJI/TRI catalog has unique metric ids and environment theme', () => {
  const ids = PHASE1_EJI_TRI_INDICATOR_DEFINITIONS.map((row) => row.metricId);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of PHASE1_EJI_TRI_INDICATOR_DEFINITIONS) {
    assert.equal(row.theme, 'environment');
    assert.ok(row.metricDefinition.length > 0);
    assert.ok(row.externalDataSourceId.length > 0);
  }
});

test('listPhase1EjiTriIndicators returns both Q9 county metrics', () => {
  const metrics = listPhase1EjiTriIndicators();
  assert.equal(metrics.length, 2);
  assert.ok(metrics.some((row) => row.metricId === 'cdc-eji-environmental-burden-score-county'));
  assert.ok(metrics.some((row) => row.metricId === 'epa-tri-facility-count-county'));
});
