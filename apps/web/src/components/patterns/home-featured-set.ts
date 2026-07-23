/**
 * Maps a public entity projection onto the slimmer homepage featured-record carousel shape.
 */

import type { PublicEntityView } from '../../data/public-seed';
import type { HomeFeaturedEntity } from '../home/home-entity-facts';

export function toHomeFeaturedEntity(entity: PublicEntityView): HomeFeaturedEntity {
  return {
    id: entity.id,
    kind: entity.kind,
    jurisdictionLabel: entity.jurisdictionLabel,
    displayName: entity.displayName,
    summary: entity.summary,
    ...(entity.era ? { era: entity.era } : {}),
    ...(entity.eraBuckets && entity.eraBuckets.length > 0
      ? { eraBuckets: entity.eraBuckets }
      : {}),
    ...(entity.claims && entity.claims.length > 0 ? { claims: entity.claims } : {}),
    ...(entity.locationPrecision ? { locationPrecision: entity.locationPrecision } : {}),
    ...(entity.geoAnchor ? { geoAnchor: entity.geoAnchor } : {}),
  };
}

/**
 * Full active-release carousel set: curated featured ids first when present, then every
 * remaining release entity without duplicates.
 */
export function buildHomeFeaturedCarouselSet(
  entities: readonly PublicEntityView[],
  curatedIds: readonly string[],
): readonly HomeFeaturedEntity[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const ordered: PublicEntityView[] = [];
  const seen = new Set<string>();

  for (const id of curatedIds) {
    const entity = byId.get(id);
    if (entity && !seen.has(id)) {
      ordered.push(entity);
      seen.add(id);
    }
  }

  for (const entity of entities) {
    if (!seen.has(entity.id)) {
      ordered.push(entity);
      seen.add(entity.id);
    }
  }

  return ordered.map(toHomeFeaturedEntity);
}
