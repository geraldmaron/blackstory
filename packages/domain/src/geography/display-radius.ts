/**
 * Client-safe geoPrecision display-radius vocabulary and helpers.
 * Kept free of `@repo/schemas` / Node builtins so map UI modules can import it
 * without pulling `node:fs` into the browser bundle.
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

export const FIXED_TIER_RADIUS_METERS: Readonly<Record<'exact-site' | 'block', number>> = {
  'exact-site': 30,
  block: 200,
};

/** [west, south, east, north] in decimal degrees same shape as `UsStateInfo.bbox`. */
export type JurisdictionBBox = readonly [west: number, south: number, east: number, north: number];

const METERS_PER_DEGREE_LATITUDE = 111_320;

/**
 * Approximate bounding radius (meters) of a lng/lat bbox: half the corner-to-corner diagonal,
 * measured from the bbox center.
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
 * derived from the jurisdiction bbox for locality/county/state.
 */
export function displayRadiusMeters(input: DisplayRadiusInput): number {
  if (input.tier === 'exact-site' || input.tier === 'block') {
    return FIXED_TIER_RADIUS_METERS[input.tier];
  }
  if (!input.jurisdictionBBox) {
    throw new Error(
      `displayRadiusMeters: tier "${input.tier}" requires a jurisdiction bbox (fail-closed)`,
    );
  }
  return boundingRadiusMeters(input.jurisdictionBBox);
}
