/**
 * Drift alarm: pure evaluation of whether sustained
 * human-vs-engine disagreement over a window exceeds a threshold. This is the calibration
 * equivalent of schema-drift quarantine missed-run silence detection
 * (packages/config/src/scheduled-jobs/health.js's evaluateMissedRuns) deliberately shaped the
 * same way: a pure "did this trip?" evaluator here, with the actual alert payload built
 * one layer up (packages/config/src/scheduled-jobs/jobs/recalibration-report.ts), exactly the
 * split health.ts/alerting.ts already use. This module has no dependency on
 * @black-book/observability @black-book/domain does not (and should not) depend on it.
 */
import type { RelevanceDecisionLogEntry } from './types.js';

export type RelevanceDriftWindow = {
  readonly start: string;
  readonly end: string;
};

export type RelevanceDriftAlarmThresholds = {
  /** 0..1 fraction of non-'accept' dispositions ('reject' + 'override') within the window. */
  readonly disagreementRateThreshold: number;
  /** Below this many decisions in the window, the evaluation is not triggered regardless of
   * rate a handful of disagreements should not page anyone. */
  readonly minimumSampleSize: number;
};

export type RelevanceDriftAlarmEvaluation = {
  readonly window: RelevanceDriftWindow;
  readonly sampleSize: number;
  readonly disagreementCount: number;
  readonly disagreementRate: number;
  readonly threshold: number;
  readonly minimumSampleSize: number;
  readonly triggered: boolean;
  readonly reason: string;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function evaluateRelevanceDriftAlarm(input: {
  readonly entries: readonly RelevanceDecisionLogEntry[];
  readonly window: RelevanceDriftWindow;
  readonly thresholds: RelevanceDriftAlarmThresholds;
}): RelevanceDriftAlarmEvaluation {
  const startMs = Date.parse(input.window.start);
  const endMs = Date.parse(input.window.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    throw new Error('Drift alarm window must be a valid, non-inverted ISO date range');
  }

  const windowed = input.entries.filter((entry) => {
    const occurredMs = Date.parse(entry.occurredAt);
    return occurredMs >= startMs && occurredMs <= endMs;
  });
  const sampleSize = windowed.length;
  const disagreementCount = windowed.filter((entry) => entry.disposition !== 'accept').length;
  const disagreementRate = sampleSize === 0 ? 0 : disagreementCount / sampleSize;
  const meetsMinimumSample = sampleSize >= input.thresholds.minimumSampleSize;
  const triggered = meetsMinimumSample && disagreementRate > input.thresholds.disagreementRateThreshold;

  const reason = triggered
    ? `Human-vs-engine disagreement rate ${formatPercent(disagreementRate)} exceeds threshold ${formatPercent(
        input.thresholds.disagreementRateThreshold,
      )} over ${sampleSize} decisions (${input.window.start} to ${input.window.end}).`
    : meetsMinimumSample
      ? `Disagreement rate ${formatPercent(disagreementRate)} is within the ${formatPercent(
          input.thresholds.disagreementRateThreshold,
        )} threshold over ${sampleSize} decisions.`
      : `Only ${sampleSize} decision(s) in window; below minimum sample size ${input.thresholds.minimumSampleSize} for drift evaluation.`;

  return {
    window: input.window,
    sampleSize,
    disagreementCount,
    disagreementRate,
    threshold: input.thresholds.disagreementRateThreshold,
    minimumSampleSize: input.thresholds.minimumSampleSize,
    triggered,
    reason,
  };
}
