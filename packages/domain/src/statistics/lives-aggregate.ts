/**
 * Pure arithmetic that turns published state figures into region figures for Lives Across the Decades.
 *
 * Every published figure is stored at state level as the table printed it. A region's figure is derived
 * here: counts summed across member states, a coverage share when some states were not published, and
 * class bands estimated within published income brackets. Nothing here fetches or guesses a value that
 * was not published. Method: docs/methodology/lives-across-decades.md.
 */

export type StateCount = {
  readonly jurisdictionId: string;
  readonly numerator: number;
  readonly denominator: number;
};

export type AggregatedRate = {
  /** Percentage, 0–100. */
  readonly ratePct: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly jurisdictionsCovered: readonly string[];
};

/** Sums numerators and denominators across the expected jurisdictions that published the figure. */
export function aggregateRate(
  rows: readonly StateCount[],
  expectedJurisdictionIds: readonly string[],
): AggregatedRate | null {
  const expected = new Set(expectedJurisdictionIds);
  let numerator = 0;
  let denominator = 0;
  const covered: string[] = [];
  for (const row of rows) {
    if (!expected.has(row.jurisdictionId)) continue;
    if (!(row.denominator > 0) || !(row.numerator >= 0)) continue;
    numerator += row.numerator;
    denominator += row.denominator;
    covered.push(row.jurisdictionId);
  }
  if (denominator === 0) return null;
  return {
    ratePct: (100 * numerator) / denominator,
    numerator,
    denominator,
    jurisdictionsCovered: covered,
  };
}

/**
 * Share of the expected group population living in jurisdictions that published the figure, or null
 * when any expected jurisdiction's population is unknown (coverage cannot then be stated honestly).
 */
export function coverageShare(
  coveredJurisdictionIds: readonly string[],
  populationByJurisdiction: ReadonlyMap<string, number>,
  expectedJurisdictionIds: readonly string[],
): number | null {
  let total = 0;
  let covered = 0;
  const coveredSet = new Set(coveredJurisdictionIds);
  for (const id of expectedJurisdictionIds) {
    const population = populationByJurisdiction.get(id);
    if (population === undefined) return null;
    total += population;
    if (coveredSet.has(id)) covered += population;
  }
  return total > 0 ? covered / total : null;
}

/** Sums a distribution (for example work-based class counts) across states and returns shares. */
export function aggregateDistribution<Bucket extends string>(
  countsByBucket: Readonly<Record<Bucket, readonly StateCount[]>>,
  expectedJurisdictionIds: readonly string[],
): { readonly sharesPct: Readonly<Record<Bucket, number>>; readonly total: number } | null {
  const expected = new Set(expectedJurisdictionIds);
  const sums = {} as Record<Bucket, number>;
  let total = 0;
  for (const bucket of Object.keys(countsByBucket) as Bucket[]) {
    let sum = 0;
    for (const row of countsByBucket[bucket]) {
      if (expected.has(row.jurisdictionId) && row.numerator >= 0) sum += row.numerator;
    }
    sums[bucket] = sum;
    total += sum;
  }
  if (total === 0) return null;
  const sharesPct = {} as Record<Bucket, number>;
  for (const bucket of Object.keys(sums) as Bucket[])
    sharesPct[bucket] = (100 * sums[bucket]) / total;
  return { sharesPct, total };
}

export type IncomeBracket = {
  /** Inclusive lower bound in dollars. */
  readonly lower: number;
  /** Exclusive upper bound in dollars (the next bracket's lower bound), or null for the open top bracket. */
  readonly upper: number | null;
  readonly count: number;
};

/** Adds bracket counts across states that published the same bracket edges. */
export function sumBrackets(bracketSets: readonly (readonly IncomeBracket[])[]): IncomeBracket[] {
  const first = bracketSets[0];
  if (!first) return [];
  return first.map((bracket, index) => {
    let count = 0;
    for (const set of bracketSets) {
      const match = set[index];
      if (!match || match.lower !== bracket.lower || match.upper !== bracket.upper) {
        throw new Error(
          `bracket edges differ at index ${index}; states must share one table layout`,
        );
      }
      count += match.count;
    }
    return { lower: bracket.lower, upper: bracket.upper, count };
  });
}

function validateBrackets(brackets: readonly IncomeBracket[]): void {
  if (brackets.length < 2) throw new Error('at least two brackets are needed');
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!;
    const isLast = i === brackets.length - 1;
    if (bracket.count < 0) throw new Error('bracket counts cannot be negative');
    if (isLast ? bracket.upper !== null : bracket.upper === null) {
      throw new Error('only the last bracket may be open');
    }
    if (!isLast && brackets[i + 1]!.lower !== bracket.upper) {
      throw new Error(`brackets are not contiguous at ${bracket.upper}`);
    }
  }
}

/**
 * Pareto shape for the open top bracket, from the two highest lower bounds (the Census Bureau's method
 * for estimating within an open-ended interval). Null when the shape cannot be estimated.
 */
function paretoAlpha(brackets: readonly IncomeBracket[]): number | null {
  const top = brackets[brackets.length - 1]!;
  const previous = brackets[brackets.length - 2]!;
  const aboveTop = top.count;
  const abovePrevious = previous.count + top.count;
  if (aboveTop <= 0 || abovePrevious <= aboveTop || previous.lower <= 0) return null;
  const alpha = Math.log(abovePrevious / aboveTop) / Math.log(top.lower / previous.lower);
  return Number.isFinite(alpha) && alpha > 0 ? alpha : null;
}

/** Estimated count below a dollar threshold, or null when the threshold falls where no estimate holds. */
export function estimateCountBelow(
  brackets: readonly IncomeBracket[],
  threshold: number,
): number | null {
  validateBrackets(brackets);
  let below = 0;
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!;
    if (threshold <= bracket.lower) return below;
    if (bracket.upper !== null) {
      if (threshold >= bracket.upper) {
        below += bracket.count;
        continue;
      }
      return (
        below + (bracket.count * (threshold - bracket.lower)) / (bracket.upper - bracket.lower)
      );
    }
    const alpha = paretoAlpha(brackets);
    if (alpha === null) return null;
    const above = bracket.count * Math.pow(bracket.lower / threshold, alpha);
    return below + (bracket.count - above);
  }
  return below;
}

export type BandShares = {
  readonly lowerPct: number;
  readonly middlePct: number;
  readonly upperPct: number;
  readonly lowerThreshold: number;
  readonly upperThreshold: number;
};

/**
 * Shares below two-thirds of the national median, between two-thirds and double, and above double,
 * estimated within published brackets. Null when a threshold lands where no estimate holds.
 */
export function estimateBandShares(
  brackets: readonly IncomeBracket[],
  nationalMedian: number,
): BandShares | null {
  if (!(nationalMedian > 0)) throw new Error('national median must be positive');
  const total = brackets.reduce((sum, bracket) => sum + bracket.count, 0);
  if (total <= 0) return null;
  const lowerThreshold = (2 / 3) * nationalMedian;
  const upperThreshold = 2 * nationalMedian;
  const belowLower = estimateCountBelow(brackets, lowerThreshold);
  const belowUpper = estimateCountBelow(brackets, upperThreshold);
  if (belowLower === null || belowUpper === null) return null;
  return {
    lowerPct: (100 * belowLower) / total,
    middlePct: (100 * (belowUpper - belowLower)) / total,
    upperPct: (100 * (total - belowUpper)) / total,
    lowerThreshold,
    upperThreshold,
  };
}

/** Median estimated within brackets, used to check the method against a published median. */
export function estimateMedian(brackets: readonly IncomeBracket[]): number | null {
  validateBrackets(brackets);
  const total = brackets.reduce((sum, bracket) => sum + bracket.count, 0);
  if (total <= 0) return null;
  const half = total / 2;
  let cumulative = 0;
  for (const bracket of brackets) {
    if (cumulative + bracket.count < half) {
      cumulative += bracket.count;
      continue;
    }
    if (bracket.upper !== null) {
      if (bracket.count === 0) return bracket.lower;
      return (
        bracket.lower + ((half - cumulative) / bracket.count) * (bracket.upper - bracket.lower)
      );
    }
    const alpha = paretoAlpha(brackets);
    if (alpha === null) return null;
    const aboveNeeded = total - half;
    return bracket.lower * Math.pow(bracket.count / aboveNeeded, 1 / alpha);
  }
  return null;
}
