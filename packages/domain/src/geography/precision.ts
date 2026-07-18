/**
 * Public location precision helpers aligned with constitution publicPrecisionRules.
 */
import { evaluatePublicPrecision, loadProductConstitution } from '@blap/schemas';
import type { LivingStatus } from '../living.js';

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
 * geoPrecision tier vocabulary.
 *
 * This is the ONE canonical definition of the exact-site|block|locality|county|state tier
 * scale. fact-registry spec (`FactRecord.geoPrecision`) imports this vocabulary
 * rather than redefining it see ./issues.jsonl "Ontology alignment"
 * note: "datePrecision and geoPrecision vocabularies are imported from the shared domain
 * modules established by single definition, no local redefinition." Any
 * future caller (fact records, entity locations, map popups) must reuse `GeoPrecisionTier`,
 * never invent a parallel enum.
 *
 * Ordered finest to coarsest the same ordering direction as `GEO_PRECISION_TIER_RANK` below.
 * This is intentionally a DIFFERENT vocabulary from `packages/security/src/redaction.ts`'s
 * `PRECISION_RANK` (country|state|county|city|neighborhood|institution|...|exact_coordinates):
 * that scale governs public-output REDACTION of internal precision levels; this scale governs
 * the geographic ANCHOR tier a location or fact is documented/geocoded at and the map display
 * radius that follows from it. The two are related (both coarsen finest→coarsest) but serve
 * different layers and must not be conflated or merged into one enum.
 */
export const GEO_PRECISION_TIERS = ['exact-site', 'block', 'locality', 'county', 'state'] as const;

export type GeoPrecisionTier = (typeof GEO_PRECISION_TIERS)[number];

export function isGeoPrecisionTier(value: string): value is GeoPrecisionTier {
  return (GEO_PRECISION_TIERS as readonly string[]).includes(value);
}

/** Finest (0) to coarsest (4) rank for the geoPrecision tier scale, for comparisons only. */
export const GEO_PRECISION_TIER_RANK: Readonly<Record<GeoPrecisionTier, number>> = {
  'exact-site': 0,
  block: 1,
  locality: 2,
  county: 3,
  state: 4,
};

/** True when `a` is strictly coarser (a larger display radius) than `b`. */
export function isCoarserGeoPrecisionTier(a: GeoPrecisionTier, b: GeoPrecisionTier): boolean {
  return GEO_PRECISION_TIER_RANK[a] > GEO_PRECISION_TIER_RANK[b];
}

/** The coarser of two geoPrecision tiers (never returns a finer tier than either input). */
export function coarserGeoPrecisionTier(a: GeoPrecisionTier, b: GeoPrecisionTier): GeoPrecisionTier {
  return GEO_PRECISION_TIER_RANK[a] >= GEO_PRECISION_TIER_RANK[b] ? a : b;
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
 * Deterministic mapping from geoPrecision tier to a display radius (meters).
 *
 * `exact-site` and `block` get fixed radii: both describe a location precise enough that a
 * jurisdiction bbox is the wrong basis for the circle (a building site or a city block does
 * not scale with county size). `locality`, `county`, and `state` radii are DERIVED from the
 * relevant jurisdiction's bbox (see `boundingRadiusMeters`) rather than hand-stored per
 * entity this keeps the radius governed by jurisdiction reference data instead of
 * an ungovernable free number that drifts entity by entity.
 */
export const FIXED_TIER_RADIUS_METERS: Readonly<Record<'exact-site' | 'block', number>> = {
  'exact-site': 30,
  block: 200,
};

/** [west, south, east, north] in decimal degrees same shape as `UsStateInfo.bbox`. */
export type JurisdictionBBox = readonly [west: number, south: number, east: number, north: number];

const METERS_PER_DEGREE_LATITUDE = 111_320;

/**
 * Approximate bounding radius (meters) of a lng/lat bbox: half the corner-to-corner diagonal,
 * measured from the bbox center. Longitude degrees are scaled by cos(latitude) so the estimate
 * stays reasonable away from the equator. This is deliberately the same order of precision as
 * `packages/domain/src/map/us-geography.ts`'s bounding boxes "good enough for national-zoom
 * presence/density aggregates," never survey-grade.
 */
export function boundingRadiusMeters(bbox: JurisdictionBBox): number {
  const [west, south, east, north] = bbox;
  const centerLatRad = (((south + north) / 2) * Math.PI) / 180;
  const widthDeg = Math.max(0, east - west);
  const heightDeg = Math.max(0, north - south);
  const widthMeters = widthDeg * METERS_PER_DEGREE_LATITUDE * Math.cos(centerLatRad);
  const heightMeters = heightDeg * METERS_PER_DEGREE_LATITUDE;
  return Math.sqrt(widthMeters ** 2 + heightMeters ** 2) / 2;
}

export type DisplayRadiusInput = {
  readonly tier: GeoPrecisionTier;
  /** Required for locality/county/state tiers; ignored (and may be omitted) for site/block. */
  readonly jurisdictionBBox?: JurisdictionBBox;
};

/**
 * Deterministic geoPrecision tier -> display radius (meters). Fixed for exact-site/block;
 * derived from the jurisdiction bbox for locality/county/state. Throws (fails closed) rather
 * than guessing when a bbox-derived tier is requested without a bbox a missing jurisdiction
 * reference must be an error, not a silently wrong radius.
 */
export function displayRadiusMeters(input: DisplayRadiusInput): number {
  if (input.tier === 'exact-site' || input.tier === 'block') {
    return FIXED_TIER_RADIUS_METERS[input.tier];
  }
  if (!input.jurisdictionBBox) {
    throw new Error(
      `displayRadiusMeters: tier "${input.tier}" requires a jurisdiction bbox (BB-091 fail-closed)`,
    );
  }
  return boundingRadiusMeters(input.jurisdictionBBox);
}

/**
 * Precision-basis default policy.
 *
 * Redaction stays the EXCEPTION, never a default: `redactLocationForPublic` and
 * `PRECISION_RANK` in `packages/security/src/redaction.ts` remain the sole authority for
 * what may be PUBLISHED, and this function does not call into or replace them it governs
 * the internal `precisionBasis` a location is stored with, one layer earlier. A bulk-loaded
 * record (e.g. a vetted historic-sites corpus import) with a documented or geocoded
 * coordinate keeps that tier and basis untouched. Only when a redaction rule has actually
 * fired (living-person residence, etc. signaled by the caller via
 * `redactionRequired: true`, normally derived from `reducePublicPrecision`/
 * `redactLocationForPublic`'s `reduced` result) does the resolved basis become
 * `redacted-by-rule` and the tier coarsen. This function never coarsens on its own
 * initiative it only reflects a redaction decision the caller has already made.
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
  const next = GEO_PRECISION_TIERS.find((candidate) => GEO_PRECISION_TIER_RANK[candidate] === nextRank);
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
        `documentedTier "${input.documentedTier}" (BB-091 fail-closed)`,
    );
  }
  return { tier: redactedTier, basis: 'redacted-by-rule' };
}
