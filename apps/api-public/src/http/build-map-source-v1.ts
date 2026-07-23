/**
 * Builds the release-coupled `MapSourceV1` FeatureCollection served by `GET /v1/map`.
 *
 * Mirrors web Explore's `buildExploreMapSource` posture: every coordinate that reaches the
 * wire shape is transitively the return value of `redactLocationForPublic` via domain
 * `buildMapSource`. This module never invents sharper precision than the public projection
 * already carries on `EntityV1.geoAnchor`.
 */
import { buildMapSource, type MapSourceEntityInput } from '@repo/domain';
import { redactLocationForPublic } from '@repo/security/redaction';
import {
  mapSourceV1Schema,
  type MapFeatureV1,
  type MapSourceV1,
  type ConfidenceTierV1,
  type GeoPrecisionTierV1,
} from '@repo/public-contracts/v1/map';
import type { EntityV1 } from '@repo/public-contracts/v1/entity';

/** Mirrors web `MAP_KIND_ENCODING` shades/glyphs (flat copper family — no heatmap). */
const KIND_ENCODING: Readonly<Record<string, { shade: string; glyph: string }>> = {
  person: { shade: '#B86B2A', glyph: 'circle' },
  place: { shade: '#E09A55', glyph: 'circle' },
  school: { shade: '#7A8B52', glyph: 'square' },
  organization: { shade: '#9A5828', glyph: 'ring' },
  institution: { shade: '#8B7355', glyph: 'ring' },
  event: { shade: '#8E4F2A', glyph: 'diamond' },
  law: { shade: '#356494', glyph: 'square' },
  case: { shade: '#7BA8D4', glyph: 'diamond' },
  publication: { shade: '#5C6B4E', glyph: 'square' },
  artifact: { shade: '#A68968', glyph: 'circle' },
  movement: { shade: '#C4683A', glyph: 'diamond' },
  other: { shade: '#6D675F', glyph: 'circle' },
};

const DEFAULT_ENCODING = { shade: '#B86B2A', glyph: 'circle' } as const;

/** Maps public-projection precision vocabulary onto MapSourceV1 geoPrecisionTier. */
export function geoPrecisionTierForPublicPrecision(precision: string): GeoPrecisionTierV1 {
  switch (precision) {
    case 'institution':
      return 'exact';
    case 'campus':
      return 'block';
    case 'neighborhood':
      return 'neighborhood';
    case 'city':
      return 'city';
    default:
      return 'unknown';
  }
}

export function highestConfidence(
  claims: EntityV1['claims'],
): ConfidenceTierV1 {
  if (claims.some((claim) => claim.confidenceLevel === 'high')) return 'high';
  if (claims.some((claim) => claim.confidenceLevel === 'medium')) return 'medium';
  if (claims.some((claim) => claim.confidenceLevel === 'low')) return 'low';
  return 'unrated';
}

function encodingFor(kind: string): { shade: string; glyph: string } {
  return KIND_ENCODING[kind] ?? DEFAULT_ENCODING;
}

function toMapSourceInput(entity: EntityV1): MapSourceEntityInput | undefined {
  const anchor = entity.geoAnchor;
  if (!anchor) return undefined;
  return {
    entityId: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    livingStatus: 'unknown',
    ...(entity.jurisdictionLabel.trim().length > 0
      ? { jurisdictionLabel: entity.jurisdictionLabel.trim() }
      : {}),
    location: {
      precision: entity.locationPrecision,
      lat: anchor.lat,
      lng: anchor.lng,
      geohash: anchor.geohash,
      matchMethod: anchor.matchMethod,
      ...(entity.locationLabel.trim().length > 0 ? { label: entity.locationLabel.trim() } : {}),
    },
  };
}

/**
 * Pure builder: EntityV1[] (already public-projection DTOs) → validated MapSourceV1.
 * Entities without a geoAnchor are skipped (same as web Explore).
 */
export function buildMapSourceV1(
  releaseId: string,
  entities: readonly EntityV1[],
  options: { readonly generatedAt?: string } = {},
): MapSourceV1 {
  const entityById = new Map(entities.map((entity) => [entity.id, entity] as const));
  const mapInputs: MapSourceEntityInput[] = [];
  for (const entity of entities) {
    const input = toMapSourceInput(entity);
    if (input) mapInputs.push(input);
  }

  const built = buildMapSource({
    releaseId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    entities: mapInputs,
    redactLocation: redactLocationForPublic,
  });

  const features: MapFeatureV1[] = [];
  for (const feature of built.featureCollection.features) {
    const entity = entityById.get(feature.properties.entityId);
    if (!entity) continue;
    const encoding = encodingFor(feature.properties.kind);
    const geoPrecisionTier = geoPrecisionTierForPublicPrecision(feature.properties.precision);
    features.push({
      type: 'Feature',
      id: feature.id,
      geometry: {
        type: 'Point',
        coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
      },
      properties: {
        entityId: entity.id,
        href: `/entity/${entity.id}`,
        kind: feature.properties.kind,
        displayName: feature.properties.displayName,
        oneLineStory: entity.summary.slice(0, 500),
        precision: feature.properties.precision,
        geoPrecisionTier,
        eraBuckets: [...(entity.eraBuckets ?? [])],
        ...(entity.status !== undefined ? { status: entity.status } : {}),
        notabilityLabels: [...(entity.notabilityLabels ?? [])],
        evidenceCount: entity.claims.length,
        confidenceTier: highestConfidence(entity.claims),
        topicTags: [...entity.topicTags],
        ...(entity.topicIds !== undefined ? { topicIds: [...entity.topicIds] } : {}),
        shade: encoding.shade,
        glyph: encoding.glyph,
        ...(feature.properties.stateFips ? { stateFips: feature.properties.stateFips } : {}),
        ...(feature.properties.statePostalCode
          ? { statePostalCode: feature.properties.statePostalCode }
          : {}),
        ...(feature.properties.stateName ? { stateName: feature.properties.stateName } : {}),
      },
    });
  }

  return mapSourceV1Schema.parse({ releaseId, features });
}
