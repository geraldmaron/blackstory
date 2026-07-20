/**
 * geocode pipeline: orchestrates address normalization, the (injected) Census Geocoder
 * fetch, jurisdiction-id resolution, exact-coordinate reduction, product-scope evaluation, the
 * geocode cache, and the manual-place-search fallback into two entry points
 * `geocodeAddress` (forward: address/ZIP text -> jurisdiction ids) and `reverseGeocodeCoordinates`
 * (browser location -> jurisdiction ids). Neither entry point performs network I/O itself; both
 * take a fetcher port backed, in production, by `../adapters/census-geo/fetch-geocode.ts`.
 */
import { normalizeAddressInput, coordinateCacheKey } from './address-normalize.js';
import { lookupUsCityCentroid, type LookupUsCityCentroid } from './city-centroid.js';
import { parseCityStateInput } from './city-normalize.js';
import {
  geoPrecisionTierForMatch,
  reduceGeocodeCoordinatePrecision,
} from './coordinate-precision.js';
import type { GeocodeCache } from './geocode-cache.js';
import { resolveJurisdictionIdsFromMatch } from './jurisdiction-ids.js';
import { buildManualPlaceSearchFallback } from './manual-fallback.js';
import { evaluateGeocodeProductScope } from './product-scope.js';
import type {
  CensusAddressGeocodeFetcher,
  CensusCoordinatesGeocodeFetcher,
  GeocodeResolution,
  ManualPlaceSearchFallback,
} from './types.js';
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';

export type GeocodeSuccess = {
  readonly ok: true;
  readonly resolution: GeocodeResolution;
  readonly cacheHit: boolean;
};
export type GeocodeFailure = { readonly ok: false; readonly fallback: ManualPlaceSearchFallback };
export type GeocodeResult = GeocodeSuccess | GeocodeFailure;

function toResolution(
  match: CensusGeocodeMatch,
  retainExactCoordinates: boolean,
): GeocodeResolution {
  const jurisdictionIds = resolveJurisdictionIdsFromMatch(match);
  const tier = geoPrecisionTierForMatch(match);
  const precision = reduceGeocodeCoordinatePrecision({ match, tier, retainExactCoordinates });
  return {
    match: {
      ...(match.matchedAddress ? { matchedAddress: match.matchedAddress } : {}),
      ...(match.stateName ? { stateName: match.stateName } : {}),
      ...(match.countyName ? { countyName: match.countyName } : {}),
      ...(match.placeName ? { placeName: match.placeName } : {}),
    },
    jurisdictionIds,
    precision,
  };
}

export type GeocodeAddressInput = {
  readonly address: string;
  readonly fetchAddressGeocode: CensusAddressGeocodeFetcher;
  /** Required for city/state locality fallback when street geocode returns empty. */
  readonly fetchCoordinatesGeocode?: CensusCoordinatesGeocodeFetcher;
  readonly lookupCityCentroid?: LookupUsCityCentroid;
  readonly cache?: GeocodeCache<GeocodeResolution>;
  readonly now?: () => number;
  /** Opt-in only see `./coordinate-precision.ts`'s module doc for the fail-safe default. */
  readonly retainExactCoordinates?: boolean;
};

async function resolveViaCityCentroid(
  address: string,
  input: GeocodeAddressInput,
  nowMs: number,
  cacheKey: string,
): Promise<GeocodeResult | undefined> {
  if (!input.fetchCoordinatesGeocode) return undefined;
  const parsed = parseCityStateInput(address);
  if (!parsed) return undefined;

  const lookup = input.lookupCityCentroid ?? lookupUsCityCentroid;
  const centroid = lookup(parsed.city, parsed.stateAbbrev);
  if (!centroid) return undefined;

  let match: CensusGeocodeMatch;
  try {
    match = await input.fetchCoordinatesGeocode({ lat: centroid.lat, lng: centroid.lng });
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  const scope = evaluateGeocodeProductScope(match);
  if (!scope.inScope) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const retainExactCoordinates = input.retainExactCoordinates === true;
  const base = toResolution(match, false);
  const placeName = base.match.placeName ?? centroid.city;
  const resolution: GeocodeResolution = {
    ...base,
    match: {
      ...base.match,
      ...(placeName ? { placeName } : {}),
    },
    ...(retainExactCoordinates
      ? {
          precision: {
            tier: 'locality' as const,
            exactCoordinatesRetained: true,
            lat: centroid.lat,
            lng: centroid.lng,
          },
        }
      : {}),
  };
  input.cache?.set(cacheKey, resolution, nowMs);
  return { ok: true, resolution, cacheHit: false };
}

/** Forward geocode: normalized address/ZIP text -> a resolved jurisdiction result, or a manual-search fallback. */
export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeResult> {
  const normalized = normalizeAddressInput(input.address);
  if (!normalized.queryText) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const nowMs = input.now?.() ?? Date.now();
  if (input.cache) {
    const cached = input.cache.get(normalized.cacheKey, nowMs);
    if (cached) {
      return { ok: true, resolution: cached, cacheHit: true };
    }
  }

  let matches: readonly CensusGeocodeMatch[];
  try {
    matches = await input.fetchAddressGeocode(normalized.queryText);
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  if (matches.length > 1) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('ambiguous_match') };
  }
  const best = matches[0];
  if (!best) {
    const cityFallback = await resolveViaCityCentroid(
      normalized.queryText,
      input,
      nowMs,
      normalized.cacheKey,
    );
    if (cityFallback) return cityFallback;
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const scope = evaluateGeocodeProductScope(best);
  if (!scope.inScope) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const resolution = toResolution(best, input.retainExactCoordinates === true);
  input.cache?.set(normalized.cacheKey, resolution, nowMs);
  return { ok: true, resolution, cacheHit: false };
}

export type ReverseGeocodeInput = {
  readonly lat: number;
  readonly lng: number;
  readonly fetchCoordinatesGeocode: CensusCoordinatesGeocodeFetcher;
  readonly cache?: GeocodeCache<GeocodeResolution>;
  readonly now?: () => number;
  readonly retainExactCoordinates?: boolean;
};

/** Reverse geocode: a browser-supplied lat/lng -> a resolved jurisdiction result, or a manual-search fallback. */
export async function reverseGeocodeCoordinates(
  input: ReverseGeocodeInput,
): Promise<GeocodeResult> {
  const cacheKey = coordinateCacheKey(input.lat, input.lng);
  const nowMs = input.now?.() ?? Date.now();

  if (input.cache) {
    const cached = input.cache.get(cacheKey, nowMs);
    if (cached) {
      return { ok: true, resolution: cached, cacheHit: true };
    }
  }

  let match: CensusGeocodeMatch;
  try {
    match = await input.fetchCoordinatesGeocode({ lat: input.lat, lng: input.lng });
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  const scope = evaluateGeocodeProductScope(match);
  if (!scope.inScope) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  // Browser-location reverse geocodes resolve to the containing jurisdiction, not a street
  // address never treated as an exact-site match regardless of `retainExactCoordinates`.
  const resolution = toResolution(match, false);
  input.cache?.set(cacheKey, resolution, nowMs);
  return { ok: true, resolution, cacheHit: false };
}
