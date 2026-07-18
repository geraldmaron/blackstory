
/**
 * performance regression budgets config-driven thresholds that fail CI when exceeded.
 * Metrics are supplied by Lighthouse CI, bundle analyzers, or synthetic harnesses; this module
 * evaluates them deterministically without network I/O.
 */

export type PerformanceMetricId =
  | 'first_contentful_paint_ms'
  | 'largest_contentful_paint_ms'
  | 'total_blocking_time_ms'
  | 'cumulative_layout_shift'
  | 'time_to_first_byte_ms'
  | 'js_transfer_kb'
  | 'css_transfer_kb'
  | 'image_transfer_kb'
  | 'font_transfer_kb'
  | 'document_request_count';

export type PerformanceBudgetThreshold = {
  readonly metric: PerformanceMetricId;
  readonly max: number;
  readonly unit: 'ms' | 'kb' | 'score' | 'count';
  readonly journey?: string;
};

export type PerformanceBudgetConfig = {
  readonly version: string;
  readonly journeys: readonly string[];
  readonly thresholds: readonly PerformanceBudgetThreshold[];
};

export type PerformanceMetricSample = {
  readonly metric: PerformanceMetricId;
  readonly value: number;
  readonly journey?: string;
};

export type PerformanceBudgetViolation = {
  readonly metric: PerformanceMetricId;
  readonly observed: number;
  readonly max: number;
  readonly unit: PerformanceBudgetThreshold['unit'];
  readonly journey?: string;
};

export type PerformanceBudgetEvaluation = {
  readonly passed: boolean;
  readonly violations: readonly PerformanceBudgetViolation[];
};

/** Default public-surface budgets tighten as real bundles stabilize post-. */
export const DEFAULT_PERFORMANCE_BUDGET = Object.freeze({
  version: 'ds-057-v1',
  journeys: Object.freeze(['search', 'explore', 'entity', 'locate', 'corrections']),
  thresholds: Object.freeze([
    { metric: 'largest_contentful_paint_ms', max: 2500, unit: 'ms' },
    { metric: 'first_contentful_paint_ms', max: 1800, unit: 'ms' },
    { metric: 'total_blocking_time_ms', max: 300, unit: 'ms' },
    { metric: 'cumulative_layout_shift', max: 0.1, unit: 'score' },
    { metric: 'time_to_first_byte_ms', max: 800, unit: 'ms' },
    { metric: 'js_transfer_kb', max: 320, unit: 'kb' },
    { metric: 'css_transfer_kb', max: 48, unit: 'kb' },
    { metric: 'image_transfer_kb', max: 512, unit: 'kb' },
    { metric: 'font_transfer_kb', max: 120, unit: 'kb' },
    { metric: 'document_request_count', max: 42, unit: 'count' },
  ] satisfies readonly PerformanceBudgetThreshold[]),
}) satisfies PerformanceBudgetConfig;

function thresholdKey(threshold: PerformanceBudgetThreshold): string {
  return `${threshold.journey ?? 'global'}:${threshold.metric}`;
}


/**
 * Evaluates sampled metrics against configured budgets. Returns violations for CI gates.
 */
export function evaluatePerformanceBudget(
  samples: readonly PerformanceMetricSample[],
  config: PerformanceBudgetConfig = DEFAULT_PERFORMANCE_BUDGET,
): PerformanceBudgetEvaluation {
  const sampleIndex = new Map<string, PerformanceMetricSample>();
  for (const sample of samples) {
    sampleIndex.set(`${sample.journey ?? 'global'}:${sample.metric}`, sample);
  }

  const violations: PerformanceBudgetViolation[] = [];
  for (const threshold of config.thresholds) {
    const sample = sampleIndex.get(thresholdKey(threshold));
    if (!sample) continue;
    if (sample.value > threshold.max) {
      violations.push({
        metric: threshold.metric,
        observed: sample.value,
        max: threshold.max,
        unit: threshold.unit,
        ...(threshold.journey !== undefined ? { journey: threshold.journey } : {}),
      });
    }
  }

  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

/** Assert helper for test runners throws with actionable violation detail. */
export function assertPerformanceBudget(
  samples: readonly PerformanceMetricSample[],
  config: PerformanceBudgetConfig = DEFAULT_PERFORMANCE_BUDGET,
): void {
  const evaluation = evaluatePerformanceBudget(samples, config);
  if (evaluation.passed) return;
  const detail = evaluation.violations
    .map((v) => `${v.journey ?? 'global'} ${v.metric}: ${v.observed}${v.unit} > ${v.max}${v.unit}`)
    .join('; ');
  throw new Error(`Performance budget exceeded: ${detail}`);
}
