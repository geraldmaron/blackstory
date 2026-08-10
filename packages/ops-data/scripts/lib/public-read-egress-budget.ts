/**
 * Pure decision logic for check-public-read-egress.ts.
 *
 * Extracted from the script for the same reason as release-catalog-publish-decision.ts: the
 * interesting part is the branching, and the branching should be testable without a live
 * database. The counter-reset case in particular is the one that would otherwise be discovered
 * in production, as a monitor that reports green forever.
 */

/** A pg_stat_statements reading for one watched statement. */
export type EgressReading = {
  readonly calls: number;
  readonly rowsReturned: number;
  /** pg_stat_statements_info.stats_reset, i.e. when these counters started accumulating. */
  readonly statsSince: Date;
};

export type EgressWatermark = EgressReading & {
  readonly capturedAt: Date;
  /**
   * The LIKE pattern these counters were captured under. Null for rows written before the column
   * existed, which are treated as not comparable.
   */
  readonly fingerprint: string | null;
};

export type EgressVerdict =
  | { readonly kind: 'first-run' }
  | { readonly kind: 'fingerprint-changed' }
  | { readonly kind: 'counters-reset' }
  | {
      readonly kind: 'measured';
      readonly callsDelta: number;
      readonly rowsDelta: number;
      readonly elapsedHours: number;
      readonly estimatedBytes: number;
      readonly projectedBytesPerDay: number;
      readonly overBudget: boolean;
    };

/**
 * Minimum elapsed time before a delta is worth judging.
 *
 * A monitor run a minute after the previous one divides a small delta by a tiny window and
 * projects an absurd daily rate. The daily schedule makes this unlikely, but `workflow_dispatch`
 * makes it reachable by hand, and a false alarm that fires on a manual re-run is a monitor people
 * learn to ignore.
 */
export const MIN_ELAPSED_HOURS_FOR_VERDICT = 0.5;

/**
 * Decide what a new reading means relative to the last one.
 *
 * `bytesPerRow` converts rows to an egress estimate. It is deliberately an input rather than a
 * constant: each watched statement returns rows of a very different size, and a single global
 * average would make the budget meaningless for all of them.
 */
export function evaluateEgress(input: {
  readonly previous: EgressWatermark | undefined;
  readonly current: EgressReading;
  readonly now: Date;
  readonly bytesPerRow: number;
  readonly budgetBytesPerDay: number;
  /** The pattern the CURRENT reading was captured under. */
  readonly fingerprint: string;
}): EgressVerdict {
  const { previous, current, now, bytesPerRow, budgetBytesPerDay, fingerprint } = input;

  if (previous === undefined) return { kind: 'first-run' };

  // Editing a fingerprint changes which statements the counters cover, so the stored total and
  // the new one describe different populations and their difference means nothing. Observed
  // live: narrowing an over-broad pattern made the next run report 20 days of accumulated rows
  // as one day of egress, a false alarm at ~6x budget. Re-baseline instead of alerting.
  if (previous.fingerprint !== fingerprint) return { kind: 'fingerprint-changed' };

  // A counter reset (server restart, extension reset, or pg_stat_statements evicting the entry
  // under `pg_stat_statements.max` pressure) makes the delta meaningless and usually negative.
  // Treat it as a baseline re-establishment, never as "no traffic". Checking stats_since alone is
  // not enough: eviction and re-registration of a single statement resets its counters while
  // stats_since for the whole extension stays put, so the counters-went-backwards test matters too.
  const resetHappened =
    current.statsSince.getTime() !== previous.statsSince.getTime() ||
    current.calls < previous.calls ||
    current.rowsReturned < previous.rowsReturned;
  if (resetHappened) return { kind: 'counters-reset' };

  const elapsedHours = (now.getTime() - previous.capturedAt.getTime()) / 3_600_000;
  if (elapsedHours < MIN_ELAPSED_HOURS_FOR_VERDICT) return { kind: 'first-run' };

  const callsDelta = current.calls - previous.calls;
  const rowsDelta = current.rowsReturned - previous.rowsReturned;
  const estimatedBytes = rowsDelta * bytesPerRow;
  const projectedBytesPerDay = (estimatedBytes / elapsedHours) * 24;

  return {
    kind: 'measured',
    callsDelta,
    rowsDelta,
    elapsedHours,
    estimatedBytes,
    projectedBytesPerDay,
    overBudget: projectedBytesPerDay > budgetBytesPerDay,
  };
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.abs(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const sign = bytes < 0 ? '-' : '';
  return `${sign}${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)}${units[unit]}`;
}
