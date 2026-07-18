/**
 * Server-side geocode pipeline for the `/locate` route: normalizes address/ZIP text,
 * calls the real Census Geocoder adapter (`@blap/domain`'s `fetchCensusAddressGeocode`
 * `fetchCensusCoordinatesGeocode`, backed by `./safe-http-client.ts`), resolves 
 * jurisdiction ids, reduces exact coordinates, checks the 50-states-+-D.C. product scope, and
 * falls back to manual place search on any failure.
 */
import {
  assertZipNotHistoricalBoundary,
  buildManualPlaceSearchFallback,
  evaluateGeocodeProductScope,
  fetchCensusAddressGeocode,
  fetchCensusCoordinatesGeocode,
  geoPrecisionTierForMatch,
  reduceGeocodeCoordinatePrecision,
  resolveJurisdictionIdsFromMatch,
  type CensusGeocodeMatch,
  type GeocodePrecisionResult,
  type ManualPlaceSearchFallback,
  type ResolvedJurisdictionIds,
} from '@blap/domain';
import { safeHttpClient } from './safe-http-client';

export type GeocodeMatchSummary = {
  readonly matchedAddress?: string;
  readonly stateName?: string;
  readonly countyName?: string;
  readonly placeName?: string;
};

export type GeocodeResolution = {
  readonly match: GeocodeMatchSummary;
  readonly jurisdictionIds: ResolvedJurisdictionIds;
  readonly precision: GeocodePrecisionResult;
};

export type GeocodeSuccess = { readonly ok: true; readonly resolution: GeocodeResolution; readonly cacheHit: boolean };
export type GeocodeFailure = { readonly ok: false; readonly fallback: ManualPlaceSearchFallback };
export type GeocodeOutcome = GeocodeSuccess | GeocodeFailure;

/**
 * Mirrors `packages/domain/src/geocode/address-normalize.ts`'s normalization pipeline exactly
 * (collapse whitespace/quotes -> expand common street-suffix abbreviations -> cache key).
 */
const STREET_SUFFIX_EXPANSIONS: Readonly<Record<string, string>> = {
  st: 'street',
  rd: 'road',
  ave: 'avenue',
  blvd: 'boulevard',
  ln: 'lane',
  dr: 'drive',
  ct: 'court',
  pl: 'place',
  ter: 'terrace',
  cir: 'circle',
  hwy: 'highway',
  pkwy: 'parkway',
  sq: 'square',
};

function normalizeAddressText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/["“”]/g, '')
    .trim();
}

function expandCommonAbbreviations(text: string): string {
  return text.replace(/\b[A-Za-z]+\.?/g, (word) => {
    const key = word.toLowerCase().replace(/\.$/, '');
    return STREET_SUFFIX_EXPANSIONS[key] ?? word;
  });
}

function normalizeAddressInput(raw: string): { readonly queryText: string; readonly cacheKey: string } {
  const queryText = expandCommonAbbreviations(normalizeAddressText(raw));
  return { queryText, cacheKey: `addr:${queryText.toUpperCase()}` };
}

function coordinateCacheKey(lat: number, lng: number): string {
  return `coord:${(Math.round(lat * 10_000) / 10_000).toFixed(4)},${(Math.round(lng * 10_000) / 10_000).toFixed(4)}`;
}

function toResolution(match: CensusGeocodeMatch, retainExactCoordinates: boolean): GeocodeResolution {
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

/**
 * Bounded in-memory TTL cache one per server
 * instance, matching this app's established rate-limit-store convention
 * (`apps/web/src/app/search/api/route.ts`'s module doc). Keyed by normalized address/coordinate
 * text; a short TTL keeps this from becoming a persistent location-history store.
 */
const GEOCODE_CACHE_TTL_MS = 15 * 60 * 1000;
const GEOCODE_CACHE_MAX_ENTRIES = 5_000;

type CacheEntry = { readonly resolution: GeocodeResolution; readonly expiresAtMs: number };

export function createLocateCache() {
  const entries = new Map<string, CacheEntry>();

  function prune(nowMs: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAtMs <= nowMs) entries.delete(key);
    }
    while (entries.size > GEOCODE_CACHE_MAX_ENTRIES) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  }

  return {
    get(key: string, nowMs: number): GeocodeResolution | undefined {
      prune(nowMs);
      const entry = entries.get(key);
      if (!entry || entry.expiresAtMs <= nowMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.resolution;
    },
    set(key: string, resolution: GeocodeResolution, nowMs: number): void {
      prune(nowMs);
      entries.set(key, { resolution, expiresAtMs: nowMs + GEOCODE_CACHE_TTL_MS });
    },
    size(): number {
      return entries.size;
    },
  };
}

export type LocateCache = ReturnType<typeof createLocateCache>;

export type GeocodeAddressOptions = {
  readonly address: string;
  readonly cache: LocateCache;
  readonly now?: () => number;
  readonly fetchAddressGeocode?: typeof fetchCensusAddressGeocode;
};

/** Forward geocode: free-text address, city/state, or ZIP -> jurisdiction ids, or a manual-search fallback.  */
export async function geocodeAddress(options: GeocodeAddressOptions): Promise<GeocodeOutcome> {
  const { queryText, cacheKey } = normalizeAddressInput(options.address);
  if (!queryText) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const nowMs = options.now?.() ?? Date.now();
  const cached = options.cache.get(cacheKey, nowMs);
  if (cached) {
    return { ok: true, resolution: cached, cacheHit: true };
  }

  const fetcher = options.fetchAddressGeocode ?? fetchCensusAddressGeocode;
  let matches: readonly CensusGeocodeMatch[];
  try {
    matches = await fetcher({ address: queryText, client: safeHttpClient });
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  if (matches.length > 1) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('ambiguous_match') };
  }
  const best = matches[0];
  if (!best) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const scope = evaluateGeocodeProductScope(best);
  if (!scope.inScope) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const resolution = toResolution(best, false);
  options.cache.set(cacheKey, resolution, nowMs);
  return { ok: true, resolution, cacheHit: false };
}

export type ReverseGeocodeOptions = {
  readonly lat: number;
  readonly lng: number;
  readonly cache: LocateCache;
  readonly now?: () => number;
  readonly fetchCoordinatesGeocode?: typeof fetchCensusCoordinatesGeocode;
};

/** Reverse geocode: browser-supplied lat/lng -> jurisdiction ids, or a manual-search fallback.  */
export async function reverseGeocodeCoordinates(options: ReverseGeocodeOptions): Promise<GeocodeOutcome> {
  const nowMs = options.now?.() ?? Date.now();
  const cacheKey = coordinateCacheKey(options.lat, options.lng);
  const cached = options.cache.get(cacheKey, nowMs);
  if (cached) {
    return { ok: true, resolution: cached, cacheHit: true };
  }

  const fetcher = options.fetchCoordinatesGeocode ?? fetchCensusCoordinatesGeocode;
  let match: CensusGeocodeMatch;
  try {
    match = await fetcher({ lat: options.lat, lng: options.lng, client: safeHttpClient });
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  const scope = evaluateGeocodeProductScope(match);
  if (!scope.inScope) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const resolution = toResolution(match, false);
  options.cache.set(cacheKey, resolution, nowMs);
  return { ok: true, resolution, cacheHit: false };
}

const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/**
 * ZIP-to-place translate-then-discard (mirrors
 * `packages/domain/src/geocode/zip-translate.ts`): the raw ZIP is sent to the geocoder as a
 * one-shot lookup query and then discarded — this function's success branch carries no `zip`
 * field, so a caller cannot thread the raw ZIP through to anything persisted just by spreading
 * the result. `assertZipNotHistoricalBoundary('modern_lookup')` fails closed if this call site is
 * ever repurposed for anything other than a live, current-day lookup.
 */
export async function translateZipToPlace(
  zip: string,
  cache: LocateCache,
  now?: () => number,
  fetchAddressGeocode?: typeof fetchCensusAddressGeocode,
): Promise<GeocodeOutcome> {
  const trimmedZip = zip.trim();
  if (!ZIP_PATTERN.test(trimmedZip)) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }
  assertZipNotHistoricalBoundary('modern_lookup');
  const outcome = await geocodeAddress({
    address: trimmedZip,
    cache,
    ...(now ? { now } : {}),
    ...(fetchAddressGeocode ? { fetchAddressGeocode } : {}),
  });
  if (!outcome.ok) {
    return outcome;
  }

  // Translate-then-discard: `matchedAddress` is Census's full
  // echoed address string, which contains the raw ZIP as trailing text dropped here so a ZIP
  // lookup's response carries no field the raw ZIP could be read back out of. A full-address
  // lookup (`geocodeAddress` called directly, not through this function) legitimately keeps
  // `matchedAddress` since the caller already supplied the whole address, not just a ZIP.
  const { matchedAddress: _discardedMatchedAddress, ...zipSafeMatch } = outcome.resolution.match;
  return {
    ...outcome,
    resolution: { ...outcome.resolution, match: zipSafeMatch },
  };
}
