/**
 * Fetches Census Geocoder results through the shared safe HTTP port never a
 * bare `fetch`, same posture as `../web-search/fetch-search.ts` and every other -style
 * adapter in this directory tree. No API key: the Census Geocoder is free and unauthenticated
 * (see ./types.ts's module doc); this adapter's own call volume is bounded by the
 * `geocoding` endpoint-class quota at the route layer (outside this package), not a vendor key.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
} from '../internet-archive/shared/http-port.js';
import { buildCensusCoordinatesUrl, buildCensusOneLineAddressUrl } from './url-builder.js';
import { normalizeCensusAddressMatch, normalizeCensusCoordinatesGeographies } from './normalizer.js';
import { parseCensusAddressGeocodeResponse, parseCensusCoordinatesGeocodeResponse } from './response-parser.js';
import type { CensusGeocodeMatch } from './types.js';

const CENSUS_ALLOWED_CONTENT_TYPES = ['application/json', 'text/json', 'application/javascript'];

export type FetchCensusAddressGeocodeInput = {
  readonly address: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly benchmark?: string;
  readonly vintage?: string;
};

/** Forward geocode: free-text address (or ZIP text) -> zero or more ranked matches. */
export async function fetchCensusAddressGeocode(
  input: FetchCensusAddressGeocodeInput,
): Promise<readonly CensusGeocodeMatch[]> {
  const url = buildCensusOneLineAddressUrl({
    address: input.address,
    ...(input.benchmark !== undefined ? { benchmark: input.benchmark } : {}),
    ...(input.vintage !== undefined ? { vintage: input.vintage } : {}),
  });
  const response = await withRetry(
    () =>
      input.client({
        url,
        method: 'GET',
        headers: { accept: 'application/json' },
        allowedContentTypes: CENSUS_ALLOWED_CONTENT_TYPES,
      }),
    { retries: input.retries ?? 2, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, CENSUS_ALLOWED_CONTENT_TYPES);
  const raw = JSON.parse(response.bodyText) as unknown;
  const rawMatches = parseCensusAddressGeocodeResponse(raw);
  return rawMatches
    .map(normalizeCensusAddressMatch)
    .filter((match): match is CensusGeocodeMatch => match !== undefined);
}

export type FetchCensusCoordinatesGeocodeInput = {
  readonly lat: number;
  readonly lng: number;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly benchmark?: string;
  readonly vintage?: string;
};

/** Reverse geocode: lat/lng -> the jurisdiction geography containing that point (no address). */
export async function fetchCensusCoordinatesGeocode(
  input: FetchCensusCoordinatesGeocodeInput,
): Promise<CensusGeocodeMatch> {
  const url = buildCensusCoordinatesUrl({
    lat: input.lat,
    lng: input.lng,
    ...(input.benchmark !== undefined ? { benchmark: input.benchmark } : {}),
    ...(input.vintage !== undefined ? { vintage: input.vintage } : {}),
  });
  const response = await withRetry(
    () =>
      input.client({
        url,
        method: 'GET',
        headers: { accept: 'application/json' },
        allowedContentTypes: CENSUS_ALLOWED_CONTENT_TYPES,
      }),
    { retries: input.retries ?? 2, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, CENSUS_ALLOWED_CONTENT_TYPES);
  const raw = JSON.parse(response.bodyText) as unknown;
  const geographies = parseCensusCoordinatesGeocodeResponse(raw);
  return normalizeCensusCoordinatesGeographies(geographies, { lat: input.lat, lng: input.lng });
}
