/**
 * The fail-closed "general crime stats never score, advisory data never scores" discipline for
 * the historic-safety engine — this is the single most load-bearing module in this package: it
 * is what keeps layer 5 (modern-context) from ever becoming a second, hidden path into the
 * composite.
 *
 * Two independent lines of defense, mirroring `../advisory.ts`'s own two-layer proof exactly:
 * 1. RUNTIME: `assertScoringInputFreeOfExcludedData` recursively scans an arbitrary
 * scoring/composite value and throws if any general-crime-context field name (this module)
 * OR any advisory-record field name (`../advisory.ts`'s own `ADVISORY_SCORING_BANNED_KEYS`)
 * appears anywhere in it. Deliberately a conservative superset — a false positive (a
 * legitimately-but-confusingly-named field) is safe; a false negative is not.
 * 2. COMPILE-TIME: `HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS` proves, via `tsc --noEmit`, that
 * `GeneralCrimeContextRecord` shares no field name with the domain's real scoring surfaces
 * (`ConfidenceComponents`, `RelevanceFeatureValue`, `RelevanceAssessment`). If a future edit
 * to any of those types ever introduces a colliding field name, the build fails before a
 * single test even runs. `../composite.ts` adds its own, second compile-time check against its
 * own `CompositeInput` type for the same reason.
 *
 * `GENERAL_CRIME_CONTEXT_BIAS_CAVEAT` is the mandatory, non-optional caveat every general-crime
 * context record must carry — reported crime measures policing patterns, not safety for Black
 * people, and blending it into a composite reproduces redlining. This module never exposes a
 * function that turns a `GeneralCrimeContextRecord` or a `PlaceAdvisoryRecord` field into a
 * feature value for any composite — there is deliberately no `*ToFeatureValue`-shaped export
 * here, on purpose (same discipline as advisory.ts).
 */
import { ADVISORY_SCORING_BANNED_KEYS, assertAdvisoryAbsentFromScoringInput } from '../advisory.js';
import type { ConfidenceComponents } from '../claims/index.js';
import type { RelevanceAssessment, RelevanceFeatureValue } from '../relevance/index.js';

export class ScoringExclusionError extends Error {}

// ---------------------------------------------------------------------------
// General-crime-context record layer 5's labeled-context-only sub-signal
// ---------------------------------------------------------------------------

/**
 * Mandatory bias caveat text. FBI CDE/NIBRS general crime reporting is recorded ONLY as clearly
 * labeled context, never a scoring input reported crime measures policing patterns (who gets
 * stopped, charged, and counted), not safety for Black people, and any composite blending it in
 * reproduces redlining logic. This constant is the single approved caveat string;../modern-
 * context.ts's `assertGeneralCrimeContextValid` rejects any record carrying a blank or
 * substantially different caveat.
 */
export const GENERAL_CRIME_CONTEXT_BIAS_CAVEAT =
  'Reported crime statistics measure policing patterns \u2014 who is stopped, charged, and ' +
  'counted \u2014 not safety for Black people specifically. This context is never scored or ' +
  'blended into any composite; it is shown, clearly labeled, for context only.';

/**
 * Field names unique to a general-crime-context record. Deliberately a conservative superset
 * (mirrors../advisory.ts's `ADVISORY_SCORING_BANNED_KEYS` convention): a legitimate but
 * confusingly-named field elsewhere just needs renaming; a missed crime-stats field name would be
 * the actual redlining-machine failure mode this module exists to prevent.
 */
export const GENERAL_CRIME_STATS_SCORING_BANNED_KEYS = [
  'generalCrimeRate',
  'nibrsOffenseCount',
  'fbiCdeCrimeIndex',
  'reportedCrimeRate',
  'crimeReportCount',
  'generalCrimeContext',
  'generalCrimeContextRecord',
  'policingPatternCaveat',
] as const;

export type GeneralCrimeContextRecord = {
  readonly placeEntityId: string;
  /** FBI CDE/NIBRS general-offense count for the reporting period, context only. */
  readonly nibrsOffenseCount?: number;
  /** Reported-crime rate per the same source, context only. */
  readonly reportedCrimeRate?: number;
  readonly asOf: string;
  readonly sourceLabel: string;
  /** Must equal `GENERAL_CRIME_CONTEXT_BIAS_CAVEAT` verbatim enforced by
   * `assertGeneralCrimeContextValid` in ../modern-context.ts. */
  readonly policingPatternCaveat: string;
};

// ---------------------------------------------------------------------------
// Runtime guard
// ---------------------------------------------------------------------------

/**
 * Recursively scans an arbitrary value for any of `bannedKeys`. Shared primitive behind both
 * `assertGeneralCrimeStatsAbsentFromScoringInput` and (by delegation)../advisory.ts's own guard.
 */
export function assertNoBannedScoringKeys(
  value: unknown,
  bannedKeys: readonly string[],
  reason: string,
  path = '$',
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoBannedScoringKeys(item, bannedKeys, reason, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (bannedKeys.includes(key)) {
        throw new ScoringExclusionError(`Field "${key}" found in scoring/composite input at ${path}.${key} — ${reason}`);
      }
      assertNoBannedScoringKeys(entry, bannedKeys, reason, `${path}.${key}`);
    }
  }
}

/**
 * Fails closed if any general-crime-stats field appears anywhere in a scoring/composite value.
 * Direct enforcement of the critical invariant: "crime stats NEVER in composite."
 */
export function assertGeneralCrimeStatsAbsentFromScoringInput(value: unknown): void {
  assertNoBannedScoringKeys(
    value,
    GENERAL_CRIME_STATS_SCORING_BANNED_KEYS,
    'general crime statistics must never enter any scoring input or composite (BB-082 critical ' +
      'invariant \u2014 reported crime measures policing patterns, not safety for Black people).',
  );
}

/**
 * Extends own advisory-absent-from-scoring guard: general-crime stats AND advisory data
 * must both be absent from anything that feeds the historic-safety composite.
 */
export function assertScoringInputFreeOfExcludedData(value: unknown): void {
  assertGeneralCrimeStatsAbsentFromScoringInput(value);
  assertAdvisoryAbsentFromScoringInput(value);
}

/** Re-exported for callers that want the raw advisory banned-key list alongside this module's own. */
export { ADVISORY_SCORING_BANNED_KEYS };

// ---------------------------------------------------------------------------
// Compile-time proof (see module doc, point 2)
// ---------------------------------------------------------------------------

type NoKeyOverlap<A, B> = Extract<keyof A, keyof B> extends never ? true : false;

export const HISTORIC_SAFETY_SCORING_TYPE_INVARIANTS: {
  readonly noOverlapWithConfidenceComponents: NoKeyOverlap<GeneralCrimeContextRecord, ConfidenceComponents>;
  readonly noOverlapWithRelevanceFeatureValue: NoKeyOverlap<GeneralCrimeContextRecord, RelevanceFeatureValue>;
  readonly noOverlapWithRelevanceAssessment: NoKeyOverlap<GeneralCrimeContextRecord, RelevanceAssessment>;
} = {
  noOverlapWithConfidenceComponents: true,
  noOverlapWithRelevanceFeatureValue: true,
  noOverlapWithRelevanceAssessment: true,
};
