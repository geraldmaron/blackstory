/**
 * Local module surface for the geocode domain module (address normalization,
 * jurisdiction-id resolution, geocode cache, exact-coordinate reduction, ZIP translate-then-
 * discard, manual-place-search fallback, and the forward/reverse geocode pipeline).
 *
 * Not yet re-exported from `../index.ts` (the `@repo/domain` package barrel). Until that
 * lands, `apps/web`'s `locate` route/components import via the documented mirror under
 * `apps/web/src/lib/geocode/` (same pattern as `packages/firebase/src/jurisdictions/resolver.ts`).
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
