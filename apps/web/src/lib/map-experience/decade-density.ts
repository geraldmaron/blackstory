/**
 * Decade density normalisation for the Time histogram.
 *
 * The archive is extremely unevenly distributed across decades: the 1600s carry single records
 * and the mid-twentieth century carries hundreds. A purely proportional bar makes every early
 * decade a sub-pixel smear, which reads as "nothing happened here" when what it means is
 * "one documented record survives here". So a decade with any records at all gets a visible
 * floor.
 *
 * The floor is honest in one specific way that matters: a decade with **zero** records gets
 * height zero, not the floor. Lifting an empty decade to a visible bar would draw presence that
 * is not in the archive, and that is a different and worse lie than the one the floor fixes.
 *
 * Pure. See docs/ui/design-direction-v9-atlas.md §5.4.
 */

export type DecadeCount = {
  /** Decade start year, e.g. 1960. */
  readonly decade: number;
  readonly count: number;
};

export type DecadeBar = {
  readonly decade: number;
  readonly count: number;
  /** 0 to 100. Zero only when the decade has no records. */
  readonly heightPercent: number;
  /** Display label, e.g. "1960s". */
  readonly label: string;
};

/**
 * Minimum height for a decade that has at least one record, as a percentage of the tallest bar.
 * Derived from the reference build's 6px floor against a 36px maximum.
 */
export const DENSITY_FLOOR_PERCENT = 17;

export function decadeLabel(decade: number): string {
  return `${decade}s`;
}

/**
 * Normalises decade counts into bar heights, chronologically ordered.
 *
 * Input order is not trusted: callers assemble these from query results, and a histogram whose
 * bars are out of order is worse than no histogram.
 */
export function decadeDensityBars(counts: readonly DecadeCount[]): readonly DecadeBar[] {
  const ordered = [...counts].sort((a, b) => a.decade - b.decade);
  const max = ordered.reduce((peak, entry) => Math.max(peak, entry.count), 0);

  return ordered.map((entry) => {
    const count = Math.max(0, entry.count);
    let heightPercent = 0;

    if (count > 0) {
      // With a single non-empty decade every bar is the tallest bar, so the ratio is 1.
      const ratio = max > 0 ? count / max : 1;
      heightPercent = DENSITY_FLOOR_PERCENT + ratio * (100 - DENSITY_FLOOR_PERCENT);
    }

    return {
      decade: entry.decade,
      count,
      heightPercent: Math.round(heightPercent * 100) / 100,
      label: decadeLabel(entry.decade),
    };
  });
}

/** Sub-line copy under the histogram. Carries the as-of-decade honesty rule from v6. */
export function decadeSubLine(bar: DecadeBar | null, totalRecords: number): string {
  if (!bar) {
    return `${totalRecords.toLocaleString('en-US')} records`;
  }
  const noun = bar.count === 1 ? 'record' : 'records';
  return `${bar.count.toLocaleString('en-US')} ${noun} · status as-of this decade`;
}
