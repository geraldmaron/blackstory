/**
 * Shared types for the geocode domain module the business-rule layer built on top of
 * the raw Census Geocoder adapter (`../adapters/census-geo/`). This module owns: address
 * normalization, jurisdiction-id resolution, the geocode cache, exact-coordinate reduction, the
 * ZIP translate-then-discard contract, and the manual-place-search fallback decision. It does
 * NOT own HTTP/network I/O (that stays in `../adapters/census-geo/fetch-geocode.ts`) or the
 * Next.js route/UI layer (`apps/web/src/app/locate/**`, `apps/web/src/lib/geocode/**`).
 */
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';
import type { GeoPrecisionTier } from '../geography/precision.js';

/** jurisdiction ids resolved from a geocode match state is required, county/place are not always resolvable. */
export type ResolvedJurisdictionIds = {
  readonly countryId: string;
  readonly stateId?: string;
  readonly countyId?: string;
  /**
   * On-demand place id (Census place FIPS-keyed), per ADR-016 "cities: on-demand only." This
   * product does not yet have a live `jurisdictions/{id}` writer for the `city` kind
   * (`packages/firebase` owns that write path). `placeId` is the deterministic id a future
   * on-demand-city-creation pass should use, and `placeCreateHint` carries the minimal fields
   * that pass would need to actually create the doc. Neither is written to Firestore by this
   * module.
   */
  readonly placeId?: string;
  readonly placeCreateHint?: PlaceCreateHint;
};

export type PlaceCreateHint = {
  readonly id: string;
  readonly name: string;
  readonly stateFips: string;
  readonly placeFips: string;
  readonly parentId: string;
};

export type GeocodePrecisionResult = {
  readonly tier: GeoPrecisionTier;
  /** `true` while the exact match coordinate is still attached; `false` once reduced. */
  readonly exactCoordinatesRetained: boolean;
  readonly lat?: number;
  readonly lng?: number;
};

/**
 * Deliberately excludes `lat`/`lng` — the exact coordinate only ever appears on
 * `GeocodeResolution.precision` (and only when `exactCoordinatesRetained` is true). This is
 * type-level enforcement: there is no field on this summary a caller could read an exact
 * coordinate from once precision has been reduced.
 */
export type GeocodeMatchSummary = {
  readonly matchedAddress?: string;
  readonly stateName?: string;
  readonly countyName?: string;
  readonly placeName?: string;
};

/** One successfully resolved geocode result, ready for the caller to render/store. */
export type GeocodeResolution = {
  readonly match: GeocodeMatchSummary;
  readonly jurisdictionIds: ResolvedJurisdictionIds;
  readonly precision: GeocodePrecisionResult;
};

export type ManualPlaceSearchReason =
  | 'no_match'
  | 'geocoder_unavailable'
  | 'geocoder_error'
  | 'ambiguous_match';

export type ManualPlaceSearchFallback = {
  readonly available: true;
  readonly reason: ManualPlaceSearchReason;
  readonly message: string;
  /** Where the UI should send the user for a manual place search (search page). */
  readonly searchHref: string;
};

/**
 * Injection seam for the live Census call: callers supply a function backed by
 * `../adapters/census-geo/fetch-geocode.ts`'s `fetchCensusAddressGeocode` (itself backed by a
 * `SafeHttpClient`) so this module's pipeline/zip-translate/pure functions stay unit-testable
 * without any network I/O.
 */
export type CensusAddressGeocodeFetcher = (queryText: string) => Promise<readonly CensusGeocodeMatch[]>;

/** Injection seam for the live Census reverse-geocode call (browser location flow). */
export type CensusCoordinatesGeocodeFetcher = (point: {
  readonly lat: number;
  readonly lng: number;
}) => Promise<CensusGeocodeMatch>;

/** Coarse, aggregate-safe analytics event never an exact coordinate or a raw address string. */
export type CoarseLocationAnalyticsEvent = {
  readonly kind: 'geocode_resolved' | 'geocode_failed' | 'browser_location_used' | 'manual_fallback_used';
  readonly jurisdictionId?: string;
  readonly geoPrecisionTier?: GeoPrecisionTier;
  readonly occurredAt: string;
};
