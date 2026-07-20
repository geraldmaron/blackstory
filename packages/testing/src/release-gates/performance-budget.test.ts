/**
 * performance budget gate tests synthetic samples prove CI can fail on regressions.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_PERFORMANCE_BUDGET,
  assertPerformanceBudget,
  evaluatePerformanceBudget,
  type PerformanceMetricSample,
} from './performance-budget.ts';

const PASSING_SAMPLES: readonly PerformanceMetricSample[] = [
  { metric: 'largest_contentful_paint_ms', value: 2100 },
  { metric: 'first_contentful_paint_ms', value: 1500 },
  { metric: 'total_blocking_time_ms', value: 180 },
  { metric: 'cumulative_layout_shift', value: 0.04 },
  { metric: 'time_to_first_byte_ms', value: 420 },
  { metric: 'js_transfer_kb', value: 280 },
  { metric: 'css_transfer_kb', value: 36 },
  { metric: 'image_transfer_kb', value: 400 },
  { metric: 'font_transfer_kb', value: 96 },
  { metric: 'document_request_count', value: 28 },
];

test('DEFAULT_PERFORMANCE_BUDGET covers every core public journey id', () => {
  assert.deepEqual(DEFAULT_PERFORMANCE_BUDGET.journeys, [
    'search',
    'explore',
    'entity',
    'locate',
    'corrections',
  ]);
  assert.ok(DEFAULT_PERFORMANCE_BUDGET.thresholds.length >= 8);
});

test('evaluatePerformanceBudget passes when samples are within thresholds', () => {
  const result = evaluatePerformanceBudget(PASSING_SAMPLES);
  assert.equal(result.passed, true);
  assert.equal(result.violations.length, 0);
});

test('evaluatePerformanceBudget fails CI when LCP exceeds budget', () => {
  const samples: PerformanceMetricSample[] = [
    ...PASSING_SAMPLES.filter((s) => s.metric !== 'largest_contentful_paint_ms'),
    { metric: 'largest_contentful_paint_ms', value: 3200 },
  ];
  const result = evaluatePerformanceBudget(samples);
  assert.equal(result.passed, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0]?.metric, 'largest_contentful_paint_ms');
});

test('assertPerformanceBudget throws with violation detail', () => {
  assert.throws(
    () => assertPerformanceBudget([{ metric: 'js_transfer_kb', value: 999 }]),
    /Performance budget exceeded.*js_transfer_kb/,
  );
});
