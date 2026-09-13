/**
 * Local USPS city/state centroid lookup for locality geocode fallback, plus a small curated
 * non-US city centroid table (2026-09-12 OWNER RULING, repo-9rkh: "the Atlas supports non-US
 * birthplaces" — Black American history has origins outside the US by definition, and a
 * missing centroid path was silently dropping documented Caribbean/West African birthplace
 * pins rather than leaving them wrong).
 *
 * Census `onelineaddress` does not match bare city/state strings. This module averages ZIP
 * centroids from the open-source `zipcodes` dataset for a city+state pair, then callers
 * reverse-geocode those coordinates through Census for jurisdiction ids (same posture as
 * `./zip-centroid.ts`). That dataset, and the Census Geocoder callers reverse-geocode through,
 * are both US-only, so `lookupNonUsCityCentroid` below does not reuse them — see its own doc.
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

export type NonUsCityCentroid = {
  readonly city: string;
  /** ISO 3166-1 alpha-2, e.g. "CU". */
  readonly countryCode: string;
  readonly lat: number;
  readonly lng: number;
};

export type LookupNonUsCityCentroid = (
  city: string,
  countryCode: string,
) => NonUsCityCentroid | undefined;

/**
 * Curated, hand-verified centroid table for documented non-US birthplaces.
 *
 * There is no bundled non-US equivalent of the `zipcodes` dataset in this project to average
 * over, and pulling in a bulk world-cities dependency for a handful of citable places is not
 * justified by the need today (per the global working-preferences ordering: existing capability
 * / existing shared utility / small local code, before a new dependency). So this is a short,
 * explicit list — coordinates taken from each city's Wikipedia infobox — grown one documented
 * birthplace at a time as research surfaces them, the same posture as `CITY_NAME_ALIASES` above.
 * A city/country pair with no row here returns `undefined`; callers keep a pin unset (a missing
 * pin is honest) rather than fall back to somewhere the person was never documented.
 */
const NON_US_CITY_CENTROIDS: readonly NonUsCityCentroid[] = [
  // Cuba (repo-9rkh: Negro Leagues Hall of Famers born before the color line ever crossed into
  // the majors — José Méndez, Martín Dihigo, Cristóbal Torriente).
  { city: 'Cárdenas', countryCode: 'CU', lat: 23.04278, lng: -81.20361 },
  { city: 'Matanzas', countryCode: 'CU', lat: 23.05111, lng: -81.57528 },
  { city: 'Cienfuegos', countryCode: 'CU', lat: 22.14556, lng: -80.43639 },
];

/** So "Cardenas" (no accent, as most sources spell it) still matches "Cárdenas" in the table. */
function foldDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Returns a hand-verified centroid for a non-US city + ISO 3166-1 alpha-2 country code, or
 * `undefined` when this table has no row for that pair yet.
 */
export function lookupNonUsCityCentroid(
  city: string,
  countryCode: string,
): NonUsCityCentroid | undefined {
  const cityTrimmed = city.trim();
  const country = countryCode.trim().toUpperCase();
  if (!cityTrimmed || country.length !== 2) return undefined;

  const cityKey = foldDiacritics(cityTrimmed.toLowerCase());
  return NON_US_CITY_CENTROIDS.find(
    (row) => row.countryCode === country && foldDiacritics(row.city.toLowerCase()) === cityKey,
  );
}
