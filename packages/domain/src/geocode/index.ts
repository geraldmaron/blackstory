/**
 * Local module surface for the BB-050 geocode domain module (address normalization,
 * jurisdiction-id resolution, geocode cache, exact-coordinate reduction, ZIP translate-then-
 * discard, manual-place-search fallback, and the forward/reverse geocode pipeline).
 *
 * NOT yet re-exported from `../index.ts` (the `@black-book/domain` package barrel) — per this
 * session's barrel-ownership rule, only the parent session merges new symbols into that file.
 * Unlike `../adapters/census-geo/index.ts` (already wired through an existing
 * `export * from './census-geo/index.js'` wildcard in `../adapters/index.ts`), this is a
 * brand-new top-level module directory with no existing wildcard chain reaching it — the parent
 * session needs to add exactly one line to `packages/domain/src/index.ts`:
 *
 *   export * from './geocode/index.js';
 *
 * Until that lands, `apps/web`'s `locate` route/components cannot import this module directly
 * through `@black-book/domain` — see the final report's "still needs wiring" note and
 * `apps/web/src/lib/geocode/`'s module docs for the documented mirror this bead ships in the
 * meantime (the same "documented duplication pending barrel merge" convention
 * `packages/firebase/src/jurisdictions/resolver.ts` already established this session).
 */
export {
  countryJurisdictionId,
  stateJurisdictionId,
  countyJurisdictionId,
  placeJurisdictionId,
  resolveJurisdictionIdsFromMatch,
} from './jurisdiction-ids.js';

export {
  normalizeAddressText,
  expandCommonAbbreviations,
  normalizeAddressInput,
  coordinateCacheKey,
  zipCacheKey,
  type NormalizedAddressInput,
} from './address-normalize.js';

export {
  DEFAULT_GEOCODE_CACHE_TTL_MS,
  DEFAULT_GEOCODE_CACHE_MAX_ENTRIES,
  createGeocodeCache,
  type GeocodeCache,
  type CreateGeocodeCacheOptions,
} from './geocode-cache.js';

export {
  reduceGeocodeCoordinatePrecision,
  geoPrecisionTierForMatch,
  type ReduceGeocodeCoordinatePrecisionInput,
} from './coordinate-precision.js';

export { buildManualPlaceSearchFallback, type BuildManualPlaceSearchFallbackOptions } from './manual-fallback.js';

export { isInProductScopeStateFips, evaluateGeocodeProductScope, type GeocodeProductScopeResult } from './product-scope.js';

export {
  translateZipToPlace,
  type TranslateZipToPlaceInput,
  type ZipTranslation,
  type ZipTranslationFailure,
  type ZipTranslationResult,
} from './zip-translate.js';

export {
  geocodeAddress,
  reverseGeocodeCoordinates,
  type GeocodeAddressInput,
  type ReverseGeocodeInput,
  type GeocodeResult,
  type GeocodeSuccess,
  type GeocodeFailure,
} from './pipeline.js';

export { buildCoarseLocationAnalyticsEvent, type BuildCoarseLocationAnalyticsEventOptions } from './analytics.js';

export type {
  ResolvedJurisdictionIds,
  PlaceCreateHint,
  GeocodePrecisionResult,
  GeocodeMatchSummary,
  GeocodeResolution,
  ManualPlaceSearchReason,
  ManualPlaceSearchFallback,
  CoarseLocationAnalyticsEvent,
  CensusAddressGeocodeFetcher,
  CensusCoordinatesGeocodeFetcher,
} from './types.js';
