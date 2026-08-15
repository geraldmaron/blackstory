/**
 * Public location precision helpers aligned with constitution publicPrecisionRules.
 * Display-radius / geoPrecision tier vocabulary lives in `./display-radius.js` (client-safe).
 */
import { evaluatePublicPrecision, loadProductConstitution } from '@repo/schemas';
import type { LivingStatus } from '../living.js';
export {
  GEO_PRECISION_TIERS,
  GEO_PRECISION_TIER_RANK,
  FIXED_TIER_RADIUS_METERS,
  isGeoPrecisionTier,
  isCoarserGeoPrecisionTier,
  coarserGeoPrecisionTier,
  boundingRadiusMeters,
  displayRadiusMeters,
  type GeoPrecisionTier,
  type JurisdictionBBox,
  type DisplayRadiusInput,
} from './display-radius.js';
import {
  GEO_PRECISION_TIERS,
  GEO_PRECISION_TIER_RANK,
  isCoarserGeoPrecisionTier,
  type GeoPrecisionTier,
} from './display-radius.js';

export type PublicPrecisionLevel = string;

/** Allowed public precision levels from the active constitution. */
export function allowedPublicPrecisionLevels(): readonly string[] {
  return loadProductConstitution().publicPrecisionRules.allowedLevels;
}

/** Prohibited public precision levels from the active constitution. */
export function prohibitedPublicPrecisionLevels(): readonly string[] {
  return loadProductConstitution().publicPrecisionRules.prohibitedLevels;
}

/**
 * Evaluate whether a precision level may appear on public projections.
 * Living residential street unit are rejected when livingStatus treats as living.
 */
export function assertPublicPrecisionAllowed(
  precision: PublicPrecisionLevel,
  options: { livingStatus?: LivingStatus } = {},
): void {
  const result = evaluatePublicPrecision(
    precision,
    options.livingStatus === undefined ? {} : { livingStatus: options.livingStatus },
  );
  if (!result.allowed) {
    throw new Error(`Public precision not allowed: ${precision} (${result.reason ?? 'denied'})`);
  }
}

export function isPublicPrecisionAllowed(
  precision: PublicPrecisionLevel,
  options: { livingStatus?: LivingStatus } = {},
): boolean {
  return evaluatePublicPrecision(
    precision,
    options.livingStatus === undefined ? {} : { livingStatus: options.livingStatus },
  ).allowed;
}

/**
 * How a stored location/fact coordinate's precision was arrived at. Recorded per
 * EntityLocation (see `packages/domain/src/geography/location.ts` `EntityLocation`) so
 * "why is this coarse" is always answerable. `redacted-by-rule` is reserved for the
 * EXCEPTION path only see the module doc below for the fail-closed default policy.
 */
export const PRECISION_BASES = [
  'source-documented',
  'geocoded',
  'approximated',
  'redacted-by-rule',
] as const;

export type PrecisionBasis = (typeof PRECISION_BASES)[number];

export function isPrecisionBasis(value: string): value is PrecisionBasis {
  return (PRECISION_BASES as readonly string[]).includes(value);
}

/**
 * Precision-basis default policy.
 *
 * Redaction stays the EXCEPTION, never a default: `redactLocationForPublic` and
 * `PRECISION_RANK` in `packages/security/src/redaction.ts` remain the sole authority for
 * what may be PUBLISHED, and this function does not call into or replace them it governs
 * the internal `precisionBasis` a location is stored with, one layer earlier.
 */
export type ResolveEntityLocationPrecisionInput = {
  /** Finest tier the location is actually documented/geocoded at. */
  readonly documentedTier: GeoPrecisionTier;
  readonly documentedBasis: Exclude<PrecisionBasis, 'redacted-by-rule'>;
  /** True only when a redaction rule requires this location to be coarsened. */
  readonly redactionRequired: boolean;
  /**
   * Tier to coarsen to when `redactionRequired` is true. Must be coarser than or equal to
   * `documentedTier`; when omitted, defaults to the next-coarser tier (fail-closed minimum).
   */
  readonly redactedTier?: GeoPrecisionTier;
};

export type ResolvedEntityLocationPrecision = {
  readonly tier: GeoPrecisionTier;
  readonly basis: PrecisionBasis;
};

function nextCoarserTier(tier: GeoPrecisionTier): GeoPrecisionTier {
  const rank = GEO_PRECISION_TIER_RANK[tier];
  const nextRank = Math.min(rank + 1, GEO_PRECISION_TIER_RANK.state);
  const next = GEO_PRECISION_TIERS.find(
    (candidate) => GEO_PRECISION_TIER_RANK[candidate] === nextRank,
  );
  return next ?? 'state';
}

export function resolveEntityLocationPrecision(
  input: ResolveEntityLocationPrecisionInput,
): ResolvedEntityLocationPrecision {
  if (!input.redactionRequired) {
    return { tier: input.documentedTier, basis: input.documentedBasis };
  }

  const redactedTier = input.redactedTier ?? nextCoarserTier(input.documentedTier);
  if (isCoarserGeoPrecisionTier(input.documentedTier, redactedTier)) {
    throw new Error(
      `resolveEntityLocationPrecision: redactedTier "${redactedTier}" must not be finer than ` +
        `documentedTier "${input.documentedTier}" (fail-closed)`,
    );
  }
  return { tier: redactedTier, basis: 'redacted-by-rule' };
}
