/**
 * Extract durable place coordinates from a Wikidata entity (P625).
 * Research enrichment only — never used by product `/locate` (ADR-008 stays Census).
 */
import { extractLocations } from '../adapters/wikimedia/extractors.js';
import type { WikidataEntity } from '../adapters/wikimedia/types.js';

export type WikidataPlaceCoordinate = {
  readonly lat: number;
  readonly lng: number;
  readonly wikidataId: string;
  readonly label?: string;
};

/**
 * Returns the first earth-coordinate P625 (via extractLocations) for an entity.
 * Undefined when the entity has no usable coordinate claim.
 */
export function coordinateFromWikidataEntity(
  entity: WikidataEntity,
  wikidataId: string,
): WikidataPlaceCoordinate | undefined {
  const locations = extractLocations(entity, 'en');
  const withCoord = locations.find((entry) => entry.coordinate !== undefined);
  if (!withCoord?.coordinate) return undefined;
  const lat = withCoord.coordinate.latitude;
  const lng = withCoord.coordinate.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  const label = entity.labels?.en?.value;
  return {
    lat,
    lng,
    wikidataId,
    ...(label ? { label } : {}),
  };
}
