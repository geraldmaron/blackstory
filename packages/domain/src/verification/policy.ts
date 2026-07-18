/**
 * Verification policy model (the related workstream): governs how often a published claim/relationship
 * (identified by entityClass + predicate) must be independently re-checked, and what source(s)
 * count as authoritative for that check. Firestore schema mirror lives at
 * `packages/firebase/src/firestore/types.ts` (`verificationPolicySchema`,
 * `verificationPolicies/{policyId}`).
 *
 * This module has NO zod dependency (this package does not depend on zod; only
 * `packages/firebase` and `packages/schemas` do) — validation here follows this package's own
 * `assertXValid` convention (see `../claims/claim.ts`), not a parsed schema.
 */
import type { EntityClass } from '../entity-class.js';

/**
 * How quickly the asserted value of a governed predicate can change in reality. Distinct from
 * `defaultReviewInterval` (the operational cadence a policy picks) — `volatilityClass` is the
 * classification driving that choice, kept as its own field so policies can be queried/grouped
 * by volatility independent of whatever interval a given policy happens to encode.
 */
export const VOLATILITY_CLASSES = ['high', 'medium', 'low', 'static'] as const;
export type VolatilityClass = (typeof VOLATILITY_CLASSES)[number];

export function isVolatilityClass(value: string): value is VolatilityClass {
  return (VOLATILITY_CLASSES as readonly string[]).includes(value);
}

export const REVIEW_INTERVAL_UNITS = ['day', 'week', 'month', 'year'] as const;
export type ReviewIntervalUnit = (typeof REVIEW_INTERVAL_UNITS)[number];

/**
 * `{ unit, count }` chosen over an ISO 8601 duration string (`'P1M'`) deliberately: every
 * consumer of this type needs arithmetic (add to a timestamp, compare against "now"), and
 * correct ISO 8601 duration arithmetic requires calendar-aware month/year math that this
 * package has no date library for. The seed cadence table (`./cadence-table.ts`) only ever
 * needs day/week/month/year granularity in a single unit, never combined units (`P1Y2M3D`), so
 * the ISO grammar's extra generality buys nothing here. Document this choice at the call site
 * if a future policy genuinely needs combined units.
 */
export type ReviewInterval = {
  readonly unit: ReviewIntervalUnit;
  readonly count: number;
};

const UNIT_MS: Readonly<Record<ReviewIntervalUnit, number>> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  // Calendar month/year lengths vary; a fixed-average approximation is adequate for "is a
  // recheck due" scheduling (not legal/billing-grade date math). 30.44 days/month average,
  // 365.25 days/year average (accounts for leap years).
  month: 30.44 * 24 * 60 * 60 * 1000,
  year: 365.25 * 24 * 60 * 60 * 1000,
};

export function reviewIntervalToMs(interval: ReviewInterval): number {
  if (!Number.isFinite(interval.count) || interval.count <= 0) {
    throw new Error('ReviewInterval count must be a positive finite number');
  }
  return interval.count * UNIT_MS[interval.unit];
}

/** Adds a `ReviewInterval` to an ISO timestamp, returning the resulting ISO timestamp. */
export function addReviewInterval(fromIso: string, interval: ReviewInterval): string {
  const fromMs = Date.parse(fromIso);
  if (!Number.isFinite(fromMs)) {
    throw new Error('addReviewInterval requires a valid ISO date for fromIso');
  }
  return new Date(fromMs + reviewIntervalToMs(interval)).toISOString();
}

export type VerificationPolicy = {
  readonly id: string;
  /** Coarse entity classes (see `../entity-class.ts`) this policy governs. */
  readonly appliesToEntityClasses: readonly EntityClass[];
  /** Claim predicates (e.g. `'vital_status'`, `'current_office'`) this policy governs. */
  readonly appliesToPredicates: readonly string[];
  readonly volatilityClass: VolatilityClass;
  readonly defaultReviewInterval: ReviewInterval;
  /** Source ids (see `../adapters/types.ts` / `../provenance/source.ts`) treated as authoritative
   * for re-verifying claims this policy governs. */
  readonly authoritativeSourceIds: readonly string[];
  /** Whether a verification run must include an active search for contradicting evidence, not
   * just a re-check of the existing authoritative source(s). */
  readonly contradictionSearchRequired: boolean;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function assertVerificationPolicyValid(policy: VerificationPolicy): void {
  if (!policy.id.trim()) throw new Error('VerificationPolicy id is required');
  if (policy.appliesToEntityClasses.length === 0) {
    throw new Error('VerificationPolicy must apply to at least one entityClass');
  }
  if (policy.appliesToPredicates.length === 0) {
    throw new Error('VerificationPolicy must apply to at least one predicate');
  }
  if (!isVolatilityClass(policy.volatilityClass)) {
    throw new Error(`Unknown volatility class: ${policy.volatilityClass}`);
  }
  // Throws if defaultReviewInterval is malformed.
  reviewIntervalToMs(policy.defaultReviewInterval);
}

/**
 * Resolves the governing policy for an entityClass + predicate pair. Policies can overlap in
 * principle (a broad policy covering every predicate on `person`, plus a narrower one scoped to
 * just `person` + `vital_status`) — ties are broken in favor of the match with the SMALLEST
 * `appliesToPredicates` list, since a shorter, more targeted predicate list signals a more
 * deliberately-scoped policy than a broad catch-all. Returns `undefined` when nothing matches;
 * callers should treat that as "unverified" / "no policy" rather than inventing a default here.
 */
export function resolveVerificationPolicy(
  policies: readonly VerificationPolicy[],
  target: { readonly entityClass: EntityClass; readonly predicate: string },
): VerificationPolicy | undefined {
  const matches = policies.filter(
    (policy) =>
      policy.appliesToEntityClasses.includes(target.entityClass) &&
      policy.appliesToPredicates.includes(target.predicate),
  );
  if (matches.length === 0) return undefined;
  return matches.reduce((best, candidate) =>
    candidate.appliesToPredicates.length < best.appliesToPredicates.length ? candidate : best,
  );
}
