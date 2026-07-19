/**
 * "Safe combination" validators for statistics (the related workstream), per the architecture
 * review: summing or otherwise combining two `StatisticalObservation`s is only valid when
 * they share a series/universe, come from compatible source data, cover disjoint
 * geographies, and share a boundary version (the tractVintage-style constraint from bd
 * memory: "Tract-keyed collections must carry explicit tractVintage: ACS 2020s releases use
 * 2020 tracts, Opportunity Atlas uses 2010 tracts — never join without a crosswalk").
 *
 * Disjointness of two jurisdictions is NOT computed here — real geometry intersection is out
 * of scope. Callers supply either a predicate or a static list of already-known-disjoint id
 * pairs (see `JurisdictionDisjointnessInput`).
 */
import type { StatisticalObservation } from './types.js';

export type JurisdictionDisjointnessInput = {
  /** Caller-supplied predicate; wins over `knownDisjointPairs` when both are given. */
  readonly isDisjoint?: (jurisdictionIdA: string, jurisdictionIdB: string) => boolean;
  /** Static allow-list of jurisdiction id pairs already known not to overlap (order-insensitive). */
  readonly knownDisjointPairs?: ReadonlyArray<readonly [string, string]>;
};

/**
 * Two identical jurisdictions are never disjoint (summing an observation with itself would
 * double-count, not combine disjoint geographies). Beyond that, this defers entirely to the
 * caller-supplied predicate or known-pairs list — no geometry is evaluated.
 */
export function jurisdictionsAreDisjoint(
  jurisdictionIdA: string,
  jurisdictionIdB: string,
  input: JurisdictionDisjointnessInput = {},
): boolean {
  if (jurisdictionIdA === jurisdictionIdB) return false;
  if (input.isDisjoint) return input.isDisjoint(jurisdictionIdA, jurisdictionIdB);
  const pairs = input.knownDisjointPairs ?? [];
  return pairs.some(
    ([a, b]) =>
      (a === jurisdictionIdA && b === jurisdictionIdB) ||
      (a === jurisdictionIdB && b === jurisdictionIdA),
  );
}

export type SafeSummationCheck = {
  readonly safe: boolean;
  /** Empty when `safe` is true; one entry per failed precondition otherwise. */
  readonly reasons: readonly string[];
};

/**
 * Validates that summing two observations' counts is safe:
 *  - same series (same metric definition, so same universe/unit/source variable by construction)
 *  - same reference period (summing across periods is a different operation, not addition)
 *  - compatible source dataset vintage (mixing e.g. an ACS 2021 5-year estimate with a 2022
 *    5-year estimate is not a valid sum)
 *  - matching boundary version (the tractVintage-style crosswalk constraint — see module doc)
 *  - disjoint geographies (via `disjointness`, since this module does no geometry)
 *
 * Returns every failed reason rather than short-circuiting on the first, so a caller can
 * surface a complete diagnostic.
 */
export function validateSafeSummation(
  a: StatisticalObservation,
  b: StatisticalObservation,
  disjointness: JurisdictionDisjointnessInput = {},
): SafeSummationCheck {
  const reasons: string[] = [];

  if (a.seriesId !== b.seriesId) {
    reasons.push(
      `series mismatch: "${a.seriesId}" vs "${b.seriesId}" — summing across series is not guaranteed to share a universe`,
    );
  }
  if (a.referencePeriod !== b.referencePeriod) {
    reasons.push(`reference period mismatch: "${a.referencePeriod}" vs "${b.referencePeriod}"`);
  }
  if (a.datasetVintage !== b.datasetVintage) {
    reasons.push(`dataset vintage mismatch: "${a.datasetVintage}" vs "${b.datasetVintage}"`);
  }
  if (a.boundaryVersion !== b.boundaryVersion) {
    reasons.push(
      `boundary version mismatch: "${a.boundaryVersion}" vs "${b.boundaryVersion}" — a crosswalk is required before combining across boundary versions`,
    );
  }
  if (!jurisdictionsAreDisjoint(a.jurisdictionId, b.jurisdictionId, disjointness)) {
    reasons.push(
      `jurisdictions "${a.jurisdictionId}" and "${b.jurisdictionId}" are not known to be disjoint`,
    );
  }

  return { safe: reasons.length === 0, reasons };
}

/**
 * Standard error of a sum of independent estimates: SE_sum = sqrt(SE1^2 + SE2^2 + ... + SEn^2).
 * Source: U.S. Census Bureau, "Instructions for Applying Statistical Testing to the American
 * Community Survey," ACS General Handbook Appendix A, "Approximating the Standard Error of a
 * Sum" — the standard formula for combining standard errors under an independence assumption
 * (no covariance term; ACS guidance treats overlapping-universe covariance as a documented
 * limitation of the approximation, not something this function attempts to correct for).
 */
export function combineStandardErrors(standardErrors: readonly number[]): number {
  if (standardErrors.length === 0) {
    throw new Error('combineStandardErrors requires at least one standard error');
  }
  const sumOfSquares = standardErrors.reduce((total, se) => total + se * se, 0);
  return Math.sqrt(sumOfSquares);
}

/**
 * Margin of error of a sum of independent estimates: MOE_sum = sqrt(MOE1^2 + MOE2^2 + ...).
 * Same derivation as `combineStandardErrors` — MOE = z * SE for a fixed confidence-level
 * multiplier z (the Census default is 1.645 for 90% confidence), and z factors out of the
 * sum-of-squares/sqrt formula as long as every input MOE was computed at the same confidence
 * level, which ACS estimates published together always are. Source: U.S. Census Bureau, ACS
 * General Handbook Appendix A, "Approximating the Margin of Error of a Sum."
 */
export function combineMarginsOfError(marginsOfError: readonly number[]): number {
  if (marginsOfError.length === 0) {
    throw new Error('combineMarginsOfError requires at least one margin of error');
  }
  const sumOfSquares = marginsOfError.reduce((total, moe) => total + moe * moe, 0);
  return Math.sqrt(sumOfSquares);
}

export type GrowthObservationInput = {
  readonly observationId: string;
  readonly estimate: number;
  /** ACS-style margin of error at a fixed confidence level (90% by Census convention). */
  readonly marginOfError?: number;
};

export type GrowthSignificanceResult =
  | {
      readonly method: 'non-overlapping-confidence-interval';
      readonly distinguishable: boolean;
      readonly startInterval: readonly [number, number];
      readonly endInterval: readonly [number, number];
    }
  | {
      readonly method: 'insufficient-margin-of-error-data';
      readonly distinguishable: null;
    };

export type GrowthRecord = {
  readonly startObservationId: string;
  readonly endObservationId: string;
  readonly absoluteChange: number;
  /** `null` when `startObservationId`'s estimate is 0 (percent change is undefined). */
  readonly percentChange: number | null;
  readonly significanceResult: GrowthSignificanceResult;
};

/**
 * Computes a growth/change record between two observations of the same series. Significance
 * is checked with the simplest defensible method — non-overlapping confidence intervals: each
 * observation's interval is `estimate ± marginOfError` (this is already the confidence
 * interval at whatever level the source's MOE convention uses, e.g. ACS's 90%); the change is
 * called `distinguishable` only when the two intervals do not overlap. This is a conservative
 * approximation (it does not compute the standard error of the difference itself), documented
 * here rather than a full two-sample z-test because ACS margin-of-error guidance recommends
 * non-overlapping CIs as an acceptable quick check (Census ACS General Handbook Appendix A).
 * When either observation lacks a margin of error, no significance claim is made.
 */
export function computeGrowthRecord(
  start: GrowthObservationInput,
  end: GrowthObservationInput,
): GrowthRecord {
  const absoluteChange = end.estimate - start.estimate;
  const percentChange =
    start.estimate === 0 ? null : (absoluteChange / Math.abs(start.estimate)) * 100;

  const significanceResult: GrowthSignificanceResult =
    start.marginOfError === undefined || end.marginOfError === undefined
      ? { method: 'insufficient-margin-of-error-data', distinguishable: null }
      : (() => {
          const startInterval: readonly [number, number] = [
            start.estimate - start.marginOfError!,
            start.estimate + start.marginOfError!,
          ];
          const endInterval: readonly [number, number] = [
            end.estimate - end.marginOfError!,
            end.estimate + end.marginOfError!,
          ];
          const overlaps = startInterval[0] <= endInterval[1] && endInterval[0] <= startInterval[1];
          return {
            method: 'non-overlapping-confidence-interval',
            distinguishable: !overlaps,
            startInterval,
            endInterval,
          };
        })();

  return {
    startObservationId: start.observationId,
    endObservationId: end.observationId,
    absoluteChange,
    percentChange,
    significanceResult,
  };
}
