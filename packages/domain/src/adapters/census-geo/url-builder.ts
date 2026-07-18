/**
 * URL construction for the U.S. Census Bureau Geocoder API. Two operations only
 * the two this needs: forward geocode-with-geographies (`onelineaddress`, address or ZIP
 * text -> match + FIPS geographies) and reverse geocode-with-geographies (`coordinates`,
 * lat/lng -> FIPS geographies). Both request `returntype=geographies` and pin
 * `benchmark`/`vintage` to the constants in `./types.ts` so results are reproducible across
 * calls rather than silently drifting to "whatever the default vintage is today."
 */
import { CENSUS_GEOCODER_BENCHMARK, CENSUS_GEOCODER_VINTAGE } from './types.js';

export const CENSUS_GEOCODER_BASE_URL = 'https://geocoding.geo.census.gov/geocoder' as const;

export type BuildCensusOneLineAddressUrlInput = {
  /** Free-text single-line address, city/state, or ZIP whatever the caller normalized. */
  readonly address: string;
  readonly benchmark?: string;
  readonly vintage?: string;
};

export function buildCensusOneLineAddressUrl(input: BuildCensusOneLineAddressUrlInput): string {
  if (!input.address.trim()) {
    throw new Error('Census geocoder address text is required');
  }
  const params = new URLSearchParams({
    address: input.address,
    benchmark: input.benchmark ?? CENSUS_GEOCODER_BENCHMARK,
    vintage: input.vintage ?? CENSUS_GEOCODER_VINTAGE,
    format: 'json',
  });
  return `${CENSUS_GEOCODER_BASE_URL}/geographies/onelineaddress?${params.toString()}`;
}

export type BuildCensusCoordinatesUrlInput = {
  readonly lat: number;
  readonly lng: number;
  readonly benchmark?: string;
  readonly vintage?: string;
};

export function buildCensusCoordinatesUrl(input: BuildCensusCoordinatesUrlInput): string {
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    throw new Error(`Census geocoder lat out of range: ${input.lat}`);
  }
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
    throw new Error(`Census geocoder lng out of range: ${input.lng}`);
  }
  const params = new URLSearchParams({
    x: String(input.lng),
    y: String(input.lat),
    benchmark: input.benchmark ?? CENSUS_GEOCODER_BENCHMARK,
    vintage: input.vintage ?? CENSUS_GEOCODER_VINTAGE,
    format: 'json',
  });
  return `${CENSUS_GEOCODER_BASE_URL}/geographies/coordinates?${params.toString()}`;
}
