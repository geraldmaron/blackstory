/**
 * Class tiers, weighted medians and weighted shares for Lives Across the Decades.
 *
 * Tiers follow the Pew Research Center method: household income divided by the square root of
 * household size, compared with the national median of that same adjusted income. Lower is
 * below two-thirds of the median, upper is above double, and middle is everything from
 * two-thirds to double inclusive. Method: docs/methodology/lives-across-decades.md.
 */

export const LIVES_TIERS = ['lower', 'middle', 'upper'] as const;

export type LivesTier = (typeof LIVES_TIERS)[number];

export const PEW_LOWER_BOUND_RATIO = 2 / 3;
export const PEW_UPPER_BOUND_RATIO = 2;

/** Household income scaled to household size (Pew equivalence scale, exponent 0.5). */
export function sizeAdjustedIncome(householdIncome: number, persons: number): number {
  if (!Number.isFinite(householdIncome)) {
    throw new Error(`household income must be finite, got ${householdIncome}`);
  }
  if (!Number.isInteger(persons) || persons < 1) {
    throw new Error(`household size must be a positive integer, got ${persons}`);
  }
  return householdIncome / Math.sqrt(persons);
}

/**
 * The tier for one size-adjusted income. Boundaries are inclusive to the middle tier:
 * exactly two-thirds of the median and exactly double the median are both middle.
 */
export function assignIncomeTier(
  adjustedIncome: number,
  nationalMedianAdjusted: number,
): LivesTier {
  if (!(nationalMedianAdjusted > 0)) {
    throw new Error(`national median must be positive, got ${nationalMedianAdjusted}`);
  }
  if (adjustedIncome < PEW_LOWER_BOUND_RATIO * nationalMedianAdjusted) return 'lower';
  if (adjustedIncome > PEW_UPPER_BOUND_RATIO * nationalMedianAdjusted) return 'upper';
  return 'middle';
}

export type WeightedValue = {
  readonly value: number;
  readonly weight: number;
};

/**
 * Weighted median. Rows with a non-positive weight carry no population and are ignored. When
 * the cumulative weight lands exactly on half the total, the median is the midpoint of that
 * value and the next one, matching the unweighted even-count convention.
 */
export function weightedMedian(rows: readonly WeightedValue[]): number {
  const usable = rows.filter((row) => row.weight > 0 && Number.isFinite(row.value));
  if (usable.length === 0) {
    throw new Error('weighted median needs at least one row with positive weight');
  }
  const sorted = [...usable].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, row) => sum + row.weight, 0);
  const half = total / 2;
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    cumulative += row.weight;
    if (Math.abs(cumulative - half) <= Number.EPSILON * total && i + 1 < sorted.length) {
      return (row.value + sorted[i + 1]!.value) / 2;
    }
    if (cumulative > half) return row.value;
  }
  return sorted[sorted.length - 1]!.value;
}

export type WeightedShare = {
  /** Percentage, 0–100. */
  readonly sharePct: number;
  readonly weightedNumerator: number;
  readonly weightedDenominator: number;
  readonly unweightedNumerator: number;
  readonly unweightedDenominator: number;
};

/** Weighted share of rows meeting a predicate, with the counts suppression needs. */
export function weightedShare<T>(
  rows: readonly T[],
  weightOf: (row: T) => number,
  predicate: (row: T) => boolean,
): WeightedShare {
  let weightedNumerator = 0;
  let weightedDenominator = 0;
  let unweightedNumerator = 0;
  let unweightedDenominator = 0;
  for (const row of rows) {
    const weight = weightOf(row);
    if (!(weight > 0)) continue;
    weightedDenominator += weight;
    unweightedDenominator += 1;
    if (predicate(row)) {
      weightedNumerator += weight;
      unweightedNumerator += 1;
    }
  }
  return {
    sharePct:
      weightedDenominator > 0 ? (100 * weightedNumerator) / weightedDenominator : Number.NaN,
    weightedNumerator,
    weightedDenominator,
    unweightedNumerator,
    unweightedDenominator,
  };
}
