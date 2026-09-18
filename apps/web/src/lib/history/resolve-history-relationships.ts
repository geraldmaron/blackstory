/** Projects exact cited relationship claims from the released entity catalog. */
import {
  extractCatalogRelationships,
  RELATIONSHIP_TYPES,
  type CatalogEntityForRelationships,
  type CatalogRelatedEntry,
  type EntityRelationship,
  type RelationshipType,
} from '@repo/domain';
import type { PublicEntityView } from '../../data/public-seed';

const RELATIONSHIP_TYPE_SET = new Set<string>(RELATIONSHIP_TYPES);

function toCatalogRelatedEntry(
  entry: NonNullable<PublicEntityView['related']>[number],
): CatalogRelatedEntry | undefined {
  if (!RELATIONSHIP_TYPE_SET.has(entry.type)) return undefined;
  return {
    id: entry.id,
    type: entry.type as RelationshipType,
    direction: entry.direction,
    ...(entry.timespan ? { timespan: entry.timespan } : {}),
  };
}

export function resolveHistoryRelationships(
  entities: readonly PublicEntityView[],
  generatedAt: string,
): readonly EntityRelationship[] {
  const { relationships } = extractCatalogRelationships(
    entities.map((entity): CatalogEntityForRelationships => {
      const related = (entity.related ?? [])
        .map((entry) => toCatalogRelatedEntry(entry))
        .filter((entry): entry is CatalogRelatedEntry => entry !== undefined);
      return {
        id: entity.id,
        ...(entity.claims.length > 0 ? { claims: entity.claims } : {}),
        ...(related.length > 0 ? { related } : {}),
      };
    }),
    { generatedAt },
  );
  return relationships;
}
