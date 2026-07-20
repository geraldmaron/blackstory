/**
 * Local USPS city/state centroid lookup for locality geocode fallback.
 *
 * Census `onelineaddress` does not match bare city/state strings. This module averages ZIP
 * centroids from the open-source `zipcodes` dataset for a city+state pair, then callers
 * reverse-geocode those coordinates through Census for jurisdiction ids (same posture as
 * `./zip-centroid.ts`).
 */
import zipcodes from 'zipcodes';

export type UsCityCentroid = {
  readonly city: string;
  readonly stateAbbrev: string;
  readonly lat: number;
  readonly lng: number;
  /** Number of ZIP rows averaged into the centroid (diagnostic / tests only). */
  readonly zipCount: number;
};

export type LookupUsCityCentroid = (
  city: string,
  stateAbbrev: string,
) => UsCityCentroid | undefined;

/**
 * Returns an approximate centroid for a U.S. city + state postal code, or `undefined` when
 * the dataset has no rows for that pair.
 */
export function lookupUsCityCentroid(
  city: string,
  stateAbbrev: string,
): UsCityCentroid | undefined {
  const cityTrimmed = city.trim();
  const state = stateAbbrev.trim().toUpperCase();
  if (!cityTrimmed || state.length !== 2) return undefined;

  const rows = zipcodes.lookupByName(cityTrimmed, state);
  if (!Array.isArray(rows) || rows.length === 0) return undefined;

  // Prefer the first finite ZIP centroid — averaging every ZIP for large cities
  // (e.g. New York) drifts into surrounding localities. Count is retained for diagnostics.
  let primary: { lat: number; lng: number; city?: string } | undefined;
  let count = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) continue;
    count += 1;
    if (!primary) {
      primary = { lat: row.latitude, lng: row.longitude, city: row.city };
    }
  }
  if (!primary || count === 0) return undefined;

  return {
    city: primary.city ?? cityTrimmed,
    stateAbbrev: state,
    lat: primary.lat,
    lng: primary.lng,
    zipCount: count,
  };
}
