/**
 * Pure classification + parsing for `backfill-nrhp-addresses.ts` intake helpers. Split into a
 * `lib/` module with no `main()` entrypoint so it can be imported by its test file without
 * triggering the orchestrating script's network/DB `main()` — matching this package's convention
 * (see `lib/nrhp-area-labels.ts`, `lib/corroborate-source.ts`) of keeping side-effect-free logic
 * out of the top-level scripts that run it against Postgres and the network.
 *
 * See `backfill-nrhp-addresses.ts`'s module doc for the outcome/tier-table reasoning; this file
 * is only the mechanics.
 */

export type NrhpArcgisAttributes = {
  readonly refnum: string;
  readonly resname: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly county: string | null;
  readonly state: string | null;
  readonly vicinity: string | null;
  readonly isExtant: string | null;
  readonly extantOther: string | null;
  readonly constraint: string | null;
  readonly srcAccu: string | null;
  readonly mapMethod: string | null;
  readonly boundaryType: string | null;
  readonly resType: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  /** Longest bbox side in km; set only for polygon-layer features (lat/lng are then the bbox center). */
  readonly extentKm?: number | null;
};

export type NrhpAddressOutcome =
  'restricted' | 'address_found' | 'vicinity' | 'coordinates_only' | 'no_match';

export type NrhpVisitability = 'extant' | 'not_extant' | 'unknown';

const FEET_TO_METERS = 0.3048;

/** NPS spells this "+/- 12 meters" / "5m" / "0.5-foot RMSE" / "Unknown" (verified across the full
 *  lane: 1,425 "+/- 12 meters", 304 "Unknown", a handful of "Nm"/"+/- N meters", one "N-foot
 *  RMSE"). Pulls the first integer-or-decimal run and converts to meters when the unit is feet;
 *  returns null when there is no number (covers "Unknown" and any future unrecognized string). */
export function parseSrcAccuMeters(srcAccu: string | null | undefined): number | null {
  if (!srcAccu) return null;
  const match = /(\d+(?:\.\d+)?)/u.exec(srcAccu);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const isFeet = /foot|feet|\bft\b/iu.test(srcAccu);
  return isFeet ? value * FEET_TO_METERS : value;
}

/** IS_EXTANT is "Yes"/"No"/"Unknown" (case varies); EXTANT_OTH is free-text prose the caller
 *  displays as-is and this function never parses. */
export function classifyVisitability(isExtant: string | null | undefined): NrhpVisitability {
  const normalized = (isExtant ?? '').trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'true' || normalized === 'extant') return 'extant';
  if (normalized === 'no' || normalized === 'false' || normalized === 'not extant')
    return 'not_extant';
  return 'unknown';
}

/**
 * The whole outcome decision in one place so the DB/network shell can stay thin.
 * Order matters: restricted always wins (never emit an address for a roster-flagged row,
 * regardless of what the layer itself says); then no_match (nothing to classify); then
 * vicinity (Address is present but describes an area, not the parcel); then address_found;
 * then coordinates_only (geometry with no usable text); everything else is no_match.
 */
export function classifyNrhpAddressOutcome(input: {
  readonly restrictedAddress: boolean;
  readonly feature: NrhpArcgisAttributes | null;
}): NrhpAddressOutcome {
  if (input.restrictedAddress) return 'restricted';
  const feature = input.feature;
  if (!feature) return 'no_match';
  const vicinityTrue = (feature.vicinity ?? '').trim().toLowerCase() === 'true';
  if (vicinityTrue) return 'vicinity';
  const address = (feature.address ?? '').trim();
  if (address.length > 0) return 'address_found';
  if (feature.lat !== null && feature.lng !== null) return 'coordinates_only';
  return 'no_match';
}

/**
 * THE tier table. One exported constant so a future standards-research pass can change the
 * proposal without touching classification or the DB/network logic in the orchestrating script.
 * Reuses this lane's own already-published precision vocabulary (see the orchestrating script's
 * module doc) — 'site' for a parcel-level address, a high-confidence coordinates_only hit, or an
 * entity_locations row this script is not allowed to touch (restricted, current tier held as-is);
 * 'neighborhood' for a coordinates_only or vicinity hit whose own SRC_ACCU says it isn't
 * parcel-accurate. A vicinity row is tiered by its point's accuracy, not by its address text.
 */
export const NRHP_ADDRESS_TIER_TABLE = {
  addressFound: 'site',
  coordinatesOnlyAccuracyThresholdMeters: 30,
  coordinatesOnlyWithinThreshold: 'site',
  coordinatesOnlyBeyondThreshold: 'neighborhood',
} as const;

export type NrhpTierProposal = {
  /** Precision tier to write, or null for outcomes this script never writes (no_match, and
   *  restricted when there is no existing tier to hold). */
  readonly tier: string | null;
  /** True when the row needs human/orchestrator attention beyond a mechanical write. */
  readonly flagged: boolean;
  readonly flagReason: string | null;
};

/** Reads only NRHP_ADDRESS_TIER_TABLE plus the row's own outcome/accuracy/current tier. */
export function proposeNrhpTier(
  outcome: NrhpAddressOutcome,
  accuracyMeters: number | null,
  currentTier: string | null,
): NrhpTierProposal {
  if (outcome === 'restricted') {
    return { tier: currentTier, flagged: true, flagReason: 'nps_restricted_address' };
  }
  if (outcome === 'address_found') {
    return { tier: NRHP_ADDRESS_TIER_TABLE.addressFound, flagged: false, flagReason: null };
  }
  // A vicinity row has no street address, but its point is NPS's own map of the property, so
  // its accuracy decides the tier exactly as for coordinates_only.
  if (outcome === 'vicinity' || outcome === 'coordinates_only') {
    const within =
      accuracyMeters !== null &&
      accuracyMeters <= NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyAccuracyThresholdMeters;
    return {
      tier: within
        ? NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyWithinThreshold
        : NRHP_ADDRESS_TIER_TABLE.coordinatesOnlyBeyondThreshold,
      flagged: false,
      flagReason: null,
    };
  }
  return { tier: null, flagged: false, flagReason: null }; // no_match
}

// ---------------------------------------------------------------------------------------------
// Polygon-layer fallback (NRHP Polygons, MapServer layer 1) for county-precision records
// ---------------------------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
/** A polygon's bbox spanning more than this is an area (neighborhood), not a single property. */
export const POLYGON_NEIGHBORHOOD_EXTENT_KM = 1.5;
/** Geometry farther than this from the record's county centroid is flagged, never applied. */
export const MAX_KM_FROM_COUNTY_CENTROID = 60;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad((bLng - aLng) / 2)) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Bbox center and longest side of an ArcGIS polygon's rings (outSR 4326). Null when empty. */
export function polygonCenterAndExtent(
  rings: readonly (readonly (readonly number[])[])[] | undefined,
): { lat: number; lng: number; extentKm: number } | null {
  const pts = (rings ?? []).flat();
  if (pts.length === 0) return null;
  const lngs = pts.map((p) => p[0]!);
  const lats = pts.map((p) => p[1]!);
  const w = Math.min(...lngs);
  const e = Math.max(...lngs);
  const s = Math.min(...lats);
  const n = Math.max(...lats);
  const lat = (s + n) / 2;
  const lng = (w + e) / 2;
  return { lat, lng, extentKm: Math.max(haversineKm(lat, w, lat, e), haversineKm(s, lng, n, lng)) };
}

const TRINOMIAL = /^\d{2}[A-Z]{1,2}\d+$/iu;
/** Burial grounds and Smithsonian-trinomial archaeological sites are never sharpened. */
export function isExcludedNrhpName(name: string): boolean {
  const n = name.trim();
  return /african burial ground|drake park/iu.test(n) || TRINOMIAL.test(n);
}

export type NrhpBackfillDecision = {
  /** Precision to write, or null when the row is left alone (see flags). */
  readonly toPrecision: 'address' | 'neighborhood' | 'city' | null;
  readonly flags: readonly string[];
};

/** Decision for a county-precision record from its polygon-layer feature (joined by refnum). */
export function decideCountyBackfill(input: {
  readonly displayName: string;
  readonly restricted: boolean;
  /** Caller-supplied exclusion (e.g. records tied to persons of unknown living status). */
  readonly excluded: boolean;
  readonly feature: NrhpArcgisAttributes | null;
  readonly countyCentroid: { readonly lat: number; readonly lng: number } | null;
}): NrhpBackfillDecision {
  const none = (flag: string): NrhpBackfillDecision => ({ toPrecision: null, flags: [flag] });
  const { feature } = input;
  if (input.excluded || isExcludedNrhpName(input.displayName)) return none('excluded');
  if (input.restricted) return none('restricted');
  if (!feature || feature.lat === null || feature.lng === null) return none('no_source');
  if (
    input.countyCentroid &&
    haversineKm(input.countyCentroid.lat, input.countyCentroid.lng, feature.lat, feature.lng) >
      MAX_KM_FROM_COUNTY_CENTROID
  ) {
    return none('far_from_county');
  }
  if ((feature.vicinity ?? '').trim().toLowerCase() === 'true') {
    return feature.city ? { toPrecision: 'city', flags: ['vicinity'] } : none('vicinity_no_city');
  }
  const isDistrict = /district/iu.test(`${feature.resname ?? ''} ${input.displayName}`);
  if (isDistrict || (feature.extentKm ?? 0) > POLYGON_NEIGHBORHOOD_EXTENT_KM) {
    return { toPrecision: 'neighborhood', flags: [] };
  }
  if (/^\d+/u.test((feature.address ?? '').trim())) return { toPrecision: 'address', flags: [] };
  return { toPrecision: 'neighborhood', flags: ['no_street_number'] };
}
