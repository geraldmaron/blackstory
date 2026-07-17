/**
 * Raw Census geography rows -> `CensusGeocodeMatch`. Extracts only the fields this
 * product needs (state/county/place FIPS + names, lat/lng) from the "States" "Counties"
 * "Incorporated Places" layers Census returns under `geographies` never the full row (which
 * also carries TIGER/MTFCC/area fields this product has no use for and would otherwise be
 * tempted to pass through unbounded).
 */
import type { RawCensusAddressMatch, RawCensusGeographiesBlock, RawCensusGeographyEntry, CensusGeocodeMatch } from './types.js';

function stringField(entry: RawCensusGeographyEntry | undefined, key: string): string | undefined {
  const value = entry?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function firstEntry(
  geographies: RawCensusGeographiesBlock | undefined,
  layerName: string,
): RawCensusGeographyEntry | undefined {
  return geographies?.[layerName]?.[0];
}

/**
 * County FIPS from Census geography rows is a 3-digit code (`COUNTY`) that must be paired with
 * the 2-digit `STATE` code to form the 5-digit county GEOID this product's jurisdiction ids use
 * (see `../../geocode/jurisdiction-ids.ts`) kept as the raw 3-digit form here; the state
 * prefix is joined at the jurisdiction-id layer, not here, so this module stays a pure
 * Census-shape extractor.
 */
export type ExtractedCensusGeography = {
  readonly stateFips?: string;
  readonly stateName?: string;
  readonly countyFips3?: string;
  readonly countyName?: string;
  readonly placeFips?: string;
  readonly placeName?: string;
};

export function extractCensusGeography(geographies: RawCensusGeographiesBlock | undefined): ExtractedCensusGeography {
  const state = firstEntry(geographies, 'States');
  const county = firstEntry(geographies, 'Counties');
  const place = firstEntry(geographies, 'Incorporated Places') ?? firstEntry(geographies, 'Census Designated Places');

  const stateFips = stringField(state, 'STATE');
  const stateName = stringField(state, 'NAME');
  const countyFips3 = stringField(county, 'COUNTY');
  const countyName = stringField(county, 'NAME');
  const placeFips = stringField(place, 'PLACE');
  const placeName = stringField(place, 'NAME');

  return {
    ...(stateFips ? { stateFips } : {}),
    ...(stateName ? { stateName } : {}),
    ...(countyFips3 ? { countyFips3 } : {}),
    ...(countyName ? { countyName } : {}),
    ...(placeFips ? { placeFips } : {}),
    ...(placeName ? { placeName } : {}),
  };
}

/** Normalizes one forward-geocode (`onelineaddress`) match. `undefined` when coordinates are absent. */
export function normalizeCensusAddressMatch(raw: RawCensusAddressMatch): CensusGeocodeMatch | undefined {
  if (!raw.coordinates) return undefined;
  const geography = extractCensusGeography(raw.geographies);
  const zip = stringField(raw.addressComponents, 'zip');

  return {
    ...(raw.matchedAddress ? { matchedAddress: raw.matchedAddress } : {}),
    lat: raw.coordinates.y,
    lng: raw.coordinates.x,
    ...geography,
    ...(zip ? { zip } : {}),
  };
}

/** Normalizes a reverse-geocode (`coordinates`) response into the same match shape. */
export function normalizeCensusCoordinatesGeographies(
  geographies: RawCensusGeographiesBlock | undefined,
  point: { readonly lat: number; readonly lng: number },
): CensusGeocodeMatch {
  return {
    lat: point.lat,
    lng: point.lng,
    ...extractCensusGeography(geographies),
  };
}
