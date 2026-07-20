/**
 * Builds a canonical EntityLocation document from a geocode hit (or retained manual
 * coordinates) with full match provenance. Shared by operator-cli `locate` and any
 * publish path that materializes `canonicalEntities/{id}/locations/{locationId}`.
 */
import { buildGeoPointFields } from './geohash.js';
import type { EntityLocation, GeographicMatchMethod, LocationRole } from './location.js';
import type { LocationEvidenceClass } from './location-audit.js';

export type BuildEntityLocationFromResolutionInput = {
  readonly locationId: string;
  readonly entityId: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: string;
  readonly label?: string;
  readonly role?: LocationRole;
  readonly matchMethod: GeographicMatchMethod;
  readonly evidenceClass: LocationEvidenceClass;
  readonly matchedAddress?: string;
  readonly jurisdictionIds?: readonly string[];
  readonly recordedAt: string;
  readonly geohashPrecision?: number;
  readonly evidenceIds?: readonly string[];
};

/**
 * Point geometry + geohash fields + GeographicMatch notes describing evidence class.
 * Confidence is qualitative only for street vs place (never a public numeric score).
 */
export function buildEntityLocationFromResolution(
  input: BuildEntityLocationFromResolutionInput,
): EntityLocation {
  const point = buildGeoPointFields(input.lat, input.lng, input.geohashPrecision ?? 9);
  const confidence =
    input.evidenceClass === 'street_address'
      ? 0.9
      : input.evidenceClass === 'named_place'
        ? 0.7
        : 0.5;

  return {
    id: input.locationId,
    entityId: input.entityId,
    role: input.role ?? 'historical',
    geometry: { type: 'Point', coordinates: [input.lng, input.lat] },
    point: {
      lat: point.lat,
      lng: point.lng,
      geohash: point.geohash,
      geohashPrefixes: point.geohashPrefixes,
    },
    precision: input.precision,
    match: {
      method: input.matchMethod,
      precision: input.precision,
      confidence,
      recordedAt: input.recordedAt,
      notes:
        `evidence=${input.evidenceClass}` +
        (input.matchedAddress ? `; matched=${input.matchedAddress}` : ''),
    },
    ...(input.jurisdictionIds ? { jurisdictionIds: [...input.jurisdictionIds] } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.evidenceIds ? { evidenceIds: [...input.evidenceIds] } : {}),
  };
}
