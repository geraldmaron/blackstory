/**
 * Publish, flag or suppress a tabulated cell. Shares and levels use different rules because a
 * relative standard error is meaningless for a share near zero. Thresholds are bound by
 * docs/methodology/lives-across-decades.md; change them there first.
 */
import { moe90 } from './margins.js';

export const LIVES_MIN_UNWEIGHTED_N = 50;
/** 90% margin, in percentage points, above which a share is suppressed. */
export const LIVES_SHARE_SUPPRESS_MOE_POINTS = 20;
/** 90% margin, in percentage points, above which a share is flagged as wide. */
export const LIVES_SHARE_WIDE_MOE_POINTS = 10;
export const LIVES_LEVEL_SUPPRESS_RSE = 0.3;
export const LIVES_LEVEL_WIDE_RSE = 0.15;

export type LivesCellState = 'published' | 'wide_margin' | 'suppressed' | 'not_measured';

export type LivesCellStateInput = {
  /** `share` values are percentages 0–100; `level` values are medians, means or rates. */
  readonly kind: 'share' | 'level';
  readonly unweightedN: number;
  readonly estimate: number;
  readonly standardError: number;
};

export type LivesCellStateResult = {
  readonly state: Exclude<LivesCellState, 'not_measured'>;
  readonly reason: string;
};

export function livesCellState(input: LivesCellStateInput): LivesCellStateResult {
  if (input.unweightedN < LIVES_MIN_UNWEIGHTED_N) {
    return {
      state: 'suppressed',
      reason: `unweighted n ${input.unweightedN} is below ${LIVES_MIN_UNWEIGHTED_N}`,
    };
  }
  if (!Number.isFinite(input.estimate) || !Number.isFinite(input.standardError)) {
    return { state: 'suppressed', reason: 'estimate or standard error is not finite' };
  }
  if (input.kind === 'share') {
    const margin = moe90(input.standardError);
    if (margin > LIVES_SHARE_SUPPRESS_MOE_POINTS) {
      return {
        state: 'suppressed',
        reason: `90% margin ±${margin.toFixed(1)} points exceeds ±${LIVES_SHARE_SUPPRESS_MOE_POINTS}`,
      };
    }
    if (margin > LIVES_SHARE_WIDE_MOE_POINTS) {
      return { state: 'wide_margin', reason: `90% margin ±${margin.toFixed(1)} points` };
    }
    return { state: 'published', reason: `90% margin ±${margin.toFixed(1)} points` };
  }
  const rse =
    input.estimate === 0
      ? input.standardError === 0
        ? 0
        : Number.POSITIVE_INFINITY
      : input.standardError / Math.abs(input.estimate);
  if (rse > LIVES_LEVEL_SUPPRESS_RSE) {
    return { state: 'suppressed', reason: `relative standard error ${formatPct(rse)} exceeds 30%` };
  }
  if (rse > LIVES_LEVEL_WIDE_RSE) {
    return { state: 'wide_margin', reason: `relative standard error ${formatPct(rse)}` };
  }
  return { state: 'published', reason: `relative standard error ${formatPct(rse)}` };
}

function formatPct(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'undefined';
}
