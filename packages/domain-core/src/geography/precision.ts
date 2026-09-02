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

/**
 * Controlled public precision tier list, coarsest to finest, per
 * `docs/security/location-precision-standard.md` §2. This is the ONE list every raw precision
 * value is normalised onto before it reaches a public surface or the redaction engine.
 */
export const PUBLIC_PRECISION_TIERS = [
  'none',
  'country',
  'state',
  'county',
  'city',
  'neighborhood',
  'campus',
  'institution',
  'site',
  'address',
] as const;

export type PublicPrecisionTier = (typeof PUBLIC_PRECISION_TIERS)[number];

export function isPublicPrecisionTier(value: string): value is PublicPrecisionTier {
  return (PUBLIC_PRECISION_TIERS as readonly string[]).includes(value);
}

/**
 * Raw precision synonyms normalised onto the controlled tier list, per the standard §2 table.
 * A raw value not present here and not already a controlled tier falls back to `city` in
 * {@link normalizePublicPrecision} (unknown -> city, never sharper).
 */
const PUBLIC_PRECISION_SYNONYMS: Readonly<Record<string, PublicPrecisionTier>> = {
  region: 'state',
  territory: 'state',
  town: 'city',
  community: 'neighborhood',
  district: 'neighborhood',
  block: 'neighborhood',
  cemetery: 'campus',
  park: 'campus',
  'park-site': 'campus',
  park_site: 'campus',
  stadium: 'campus',
  garrison: 'campus',
  camp: 'campus',
  building: 'institution',
  street_address: 'address',
};

/**
 * Normalise any raw precision value onto the controlled public tier list (§2). Unknown raw
 * values fall to `city`, never to a finer tier than the standard's fail-safe default.
 */
export function normalizePublicPrecision(raw: string | undefined): PublicPrecisionTier {
  if (raw === undefined) {
    return 'city';
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) {
    return 'city';
  }
  if (isPublicPrecisionTier(trimmed)) {
    return trimmed;
  }
  const synonym = PUBLIC_PRECISION_SYNONYMS[trimmed];
  return synonym ?? 'city';
}

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
