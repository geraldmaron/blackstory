/**
 * Exact-coordinate reduction for geocode results ("exact
 * coordinates are reduced when no longer needed"; ADR-008 decision 5).
 *
 * A geocode/reverse-geocode call needs the EXACT lat/lng only long enough to resolve
 * jurisdiction ids (state/county/place) once that resolution has happened, the exact
 * coordinate serves no further product purpose for an ordinary address/location lookup and is
 * dropped by default. This is a DIFFERENT, earlier-layer decision from
 * `packages/security/src/redaction.ts`'s `reducePublicPrecision`/`redactLocationForPublic`
 * (which governs what a PUBLISHED entity location may show); this module governs what the
 * geocode response itself retains immediately after a lookup, before anything is published or
 * even necessarily persisted. Both follow the same non-negotiable direction (coarser, never
 * finer) but are not merged into one function see `../geography/precision.ts`'s module doc for
 * why the two scales already documented in this repo (`GeoPrecisionTier` vs
 * `packages/security/src/redaction.ts`'s `PRECISION_RANK`) stay separate.
 *
 * Fail-safe default: `neededForPublic`/`retainExactCoordinates` both default to `false`. A
 * caller must opt IN to keeping the exact coordinate (e.g. centering a single-result map pin for
 * the remainder of the current request/response cycle) it is never kept by default.
 */
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';
import type { GeoPrecisionTier } from '../geography/precision.js';
import type { GeocodePrecisionResult } from './types.js';

export type ReduceGeocodeCoordinatePrecisionInput = {
  readonly match: CensusGeocodeMatch;
  /** The finest tier this match actually resolved to (exact-site for a full address match). */
  readonly tier: GeoPrecisionTier;
  /**
   * True only when the exact coordinate is genuinely needed for the CURRENT response (e.g.
   * rendering one selected result pin). Defaults to false the coordinate is reduced/dropped
   * unless a caller explicitly asks to keep it.
   */
  readonly retainExactCoordinates?: boolean;
};

/**
 * Reduces (or keeps, when explicitly requested) the exact coordinate on a geocode result.
 * "Reduced" here means dropped entirely for `locality`/`county`/`state` tiers (those tiers
 * already have a governed jurisdiction-bbox-derived display radius per
 * `../geography/precision.ts`'s `displayRadiusMeters` an exact point adds nothing but
 * precision risk) and retained only transiently for `exact-site`/`block` tiers when the caller
 * opts in.
 */
export function reduceGeocodeCoordinatePrecision(
  input: ReduceGeocodeCoordinatePrecisionInput,
): GeocodePrecisionResult {
  const retain = input.retainExactCoordinates === true;
  const fineTier = input.tier === 'exact-site' || input.tier === 'block';

  if (fineTier && retain) {
    return {
      tier: input.tier,
      exactCoordinatesRetained: true,
      lat: input.match.lat,
      lng: input.match.lng,
    };
  }

  return {
    tier: input.tier,
    exactCoordinatesRetained: false,
  };
}

/** Given a resolved jurisdiction depth, the finest geoPrecision tier a geocode match supports. */
export function geoPrecisionTierForMatch(match: CensusGeocodeMatch): GeoPrecisionTier {
  if (match.matchedAddress) return 'exact-site';
  if (match.placeFips) return 'locality';
  if (match.countyFips3) return 'county';
  if (match.stateFips) return 'state';
  return 'state';
}
