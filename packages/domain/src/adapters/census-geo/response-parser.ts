/**
 * Defensive JSON parsing for Census Geocoder responses mirrors
 * `../web-search/brave-client.ts`'s `parseBraveSearchResponse` posture: a missing/renamed field
 * degrades one match (or the whole geographies block, for the coordinates endpoint) rather than
 * throwing on a shape the vendor is free to evolve without notice.
 */
import type {
  RawCensusAddressGeocodeResponse,
  RawCensusAddressMatch,
  RawCensusCoordinatesGeocodeResponse,
  RawCensusGeographiesBlock,
  RawCensusGeographyEntry,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asGeographyEntry(value: unknown): RawCensusGeographyEntry | undefined {
  return isRecord(value) ? (value as RawCensusGeographyEntry) : undefined;
}

function parseGeographiesBlock(value: unknown): RawCensusGeographiesBlock | undefined {
  if (!isRecord(value)) return undefined;
  const block: Record<string, readonly RawCensusGeographyEntry[]> = {};
  for (const [layerName, rows] of Object.entries(value)) {
    if (!Array.isArray(rows)) continue;
    const entries = rows
      .map(asGeographyEntry)
      .filter((row): row is RawCensusGeographyEntry => row !== undefined);
    block[layerName] = entries;
  }
  return block;
}

function parseAddressMatch(raw: unknown): RawCensusAddressMatch | undefined {
  if (!isRecord(raw)) return undefined;
  const coordinatesRaw = raw.coordinates;
  const coordinates =
    isRecord(coordinatesRaw) &&
    typeof coordinatesRaw.x === 'number' &&
    typeof coordinatesRaw.y === 'number'
      ? { x: coordinatesRaw.x, y: coordinatesRaw.y }
      : undefined;
  const tigerLine = isRecord(raw.tigerLine) ? raw.tigerLine : undefined;
  const addressComponents = isRecord(raw.addressComponents) ? raw.addressComponents : undefined;
  const matchedAddress = typeof raw.matchedAddress === 'string' ? raw.matchedAddress : undefined;
  const geographies = parseGeographiesBlock(raw.geographies);

  return {
    ...(tigerLine ? { tigerLine } : {}),
    ...(coordinates ? { coordinates } : {}),
    ...(addressComponents ? { addressComponents } : {}),
    ...(matchedAddress ? { matchedAddress } : {}),
    ...(geographies ? { geographies } : {}),
  };
}

/** Parses a `returntype=geographies&searchtype=onelineaddress` JSON response defensively. */
export function parseCensusAddressGeocodeResponse(raw: unknown): readonly RawCensusAddressMatch[] {
  const response = raw as RawCensusAddressGeocodeResponse;
  const rawMatches = response?.result?.addressMatches;
  if (!Array.isArray(rawMatches)) return [];
  return rawMatches
    .map(parseAddressMatch)
    .filter((match): match is RawCensusAddressMatch => match !== undefined);
}

/** Parses a `geographies/coordinates` (reverse geocode) JSON response defensively. */
export function parseCensusCoordinatesGeocodeResponse(
  raw: unknown,
): RawCensusGeographiesBlock | undefined {
  const response = raw as RawCensusCoordinatesGeocodeResponse;
  return parseGeographiesBlock(response?.result?.geographies);
}
