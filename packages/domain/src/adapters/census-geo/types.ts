/**
 * U.S. Census Bureau Geocoder API request/response types the LIVE, per-request
 * geocoding service at geocoding.geo.census.gov, distinct from the bulk TIGER/Gazetteer
 * reference-file contract in `./contract.ts` (annual state/county load). Both are
 * "census-geo" because they share one vendor and one adapter directory, but this module's
 * types back real-time address/coordinate lookups, not the bulk registry entry.
 *
 * Shapes below follow the documented Census Geocoding Services API
 * (https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html): `returntype=geographies`
 * responses nest a nation-wide `geographies` object keyed by human-readable layer name
 * ("States", "Counties", "Incorporated Places",...), each an array of loosely-typed rows whose
 * fields vary by layer (STATE/COUNTY/PLACE FIPS, NAME, GEOID). Parsing is defensive throughout
 * (see ./response-parser.ts) because the Census API is not versioned in a way this repo controls
 * and a missing/renamed field must degrade one match, never throw on the whole batch.
 *
 * No API key, no cost, no rate-limit contract from the vendor (public, unauthenticated,
 * "reasonable use" service) see docs/adr/ADR-008-search-and-geocoding.md decision 4. This
 * repo's own `geocoding` endpoint-class quota (packages/security/src/rate-limits.ts) is
 * what actually bounds call volume, not a vendor-issued key.
 */

/** Census "benchmark" (address range vintage) used for every request in this adapter. */
export const CENSUS_GEOCODER_BENCHMARK = 'Public_AR_Current' as const;

/** Census "vintage" (geography vintage) used for every request in this adapter. */
export const CENSUS_GEOCODER_VINTAGE = 'Current_Current' as const;

/** [lng, lat] matches this repo's `GeoGeometry` Point coordinate order (location.ts). */
export type RawCensusCoordinates = {
  readonly x: number;
  readonly y: number;
};

/** Loosely typed: field presence/casing varies by Census geography layer. */
export type RawCensusGeographyEntry = Readonly<Record<string, unknown>>;

/** Keyed by human-readable Census layer name, e.g. "States", "Counties", "Incorporated Places". */
export type RawCensusGeographiesBlock = Readonly<
  Record<string, readonly RawCensusGeographyEntry[] | undefined>
>;

export type RawCensusAddressMatch = {
  readonly tigerLine?: Readonly<Record<string, unknown>>;
  readonly coordinates?: RawCensusCoordinates;
  readonly addressComponents?: Readonly<Record<string, unknown>>;
  readonly matchedAddress?: string;
  readonly geographies?: RawCensusGeographiesBlock;
};

export type RawCensusAddressGeocodeResponse = {
  readonly result?: {
    readonly input?: unknown;
    readonly addressMatches?: readonly unknown[];
  };
};

export type RawCensusCoordinatesGeocodeResponse = {
  readonly result?: {
    readonly input?: unknown;
    readonly geographies?: RawCensusGeographiesBlock;
  };
};

/**
 * Normalized match: the Census FIPS/name fields this adapter's callers actually need,
 * extracted defensively from whichever layer rows were present. `zip` is carried ONLY as a
 * transient field on this in-memory type for the duration of one geocode call see
 * `../../geocode/zip-translate.ts`'s module doc for the translate-then-discard contract that
 * governs every caller of this type; nothing in this adapter persists it.
 */
export type CensusGeocodeMatch = {
  readonly matchedAddress?: string;
  readonly lat: number;
  readonly lng: number;
  readonly stateFips?: string;
  readonly stateName?: string;
  readonly countyFips3?: string;
  readonly countyName?: string;
  readonly placeFips?: string;
  readonly placeName?: string;
  readonly zip?: string;
};

export type CensusGeocodeRejection = {
  readonly index: number;
  readonly reason: string;
};

export type CensusGeocodeBatch = {
  readonly matches: readonly CensusGeocodeMatch[];
  readonly rejected: readonly CensusGeocodeRejection[];
};
