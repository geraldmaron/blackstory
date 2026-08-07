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
 * The dataset spells these prefixes out, so a caller passing the everyday abbreviation misses a
 * city that is plainly present — "St. Louis, MO" returned nothing while "Saint Louis, MO"
 * resolved. Sources write the abbreviated form far more often than the expanded one.
 */
const CITY_PREFIX_EXPANSIONS: readonly (readonly [RegExp, string])[] = [
  [/^st\.?\s+/i, 'Saint '],
  [/^ste\.?\s+/i, 'Sainte '],
  [/^mt\.?\s+/i, 'Mount '],
  [/^ft\.?\s+/i, 'Fort '],
];

/**
 * The dataset stores the bare municipality name, so the conversational forms sources use —
 * "New York City", "NYC" — miss a city that is obviously present.
 */
const CITY_NAME_ALIASES: Readonly<Record<string, string>> = {
  'new york city': 'New York',
  nyc: 'New York',
};

/** Name variants to try, in order, before declaring a city unknown. */
function cityNameVariants(city: string): readonly string[] {
  const variants = [city];
  const alias = CITY_NAME_ALIASES[city.toLowerCase()];
  if (alias) variants.push(alias);
  for (const [pattern, replacement] of CITY_PREFIX_EXPANSIONS) {
    if (pattern.test(city)) variants.push(city.replace(pattern, replacement));
  }
  // "St Louis" (no period) and "St. Louis" both normalize above; also try dropping a stray period.
  if (city.includes('.')) variants.push(city.replace(/\./g, ''));
  return [...new Set(variants)];
}

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

  let rows: ReturnType<typeof zipcodes.lookupByName> | undefined;
  for (const variant of cityNameVariants(cityTrimmed)) {
    const candidate = zipcodes.lookupByName(variant, state);
    if (Array.isArray(candidate) && candidate.length > 0) {
      rows = candidate;
      break;
    }
  }
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
