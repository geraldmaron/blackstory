/**
 * Converts national-catalog inline `related` shortcuts into canonical
 * `EntityRelationship` records and projects relationships back to public
 * adjacency entries for release materialization.
 *
 * Stored mentions must identify an existing catalog entity exactly. Legacy names, aliases
 * and acronyms require research resolution before they can contribute a relationship.
 * Only released, cited claims naming the exact predicate and target can support an edge.
 * This projection does not perform independent review or create publication authority.
 */
import { resolveReleaseClaimId, type ReleaseSourceClaim } from '../publication/release-builder.js';
import type { EntityRelationship, RelationshipType, TemporalContext } from '../relationship.js';
import { RELATIONSHIP_TYPES } from '../relationship.js';
import {
  buildAllEntityAdjacency,
  toPublicRelatedEntries,
  type PublicRelatedEntry,
} from './adjacency.js';
import { buildMentionResolverIndex, resolveMentionToken } from './mention-resolver.js';

export type CatalogRelatedEntry = {
  readonly id: string;
  readonly type: RelationshipType;
  readonly direction: 'outgoing' | 'incoming';
  readonly timespan?: TemporalContext;
};

export type CatalogEntityForRelationships = {
  readonly id: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
  readonly claims?: readonly ReleaseSourceClaim[];
  readonly related?: readonly CatalogRelatedEntry[];
  /** Exact catalog references; mentions still require a supporting relationship claim. */
  readonly mentionedEntityIds?: readonly string[];
};

export type ExtractCatalogRelationshipsOptions = {
  readonly generatedAt: string;
};

export type ExtractCatalogRelationshipsResult = {
  readonly relationships: readonly EntityRelationship[];
  readonly skipped: readonly string[];
};

type ResolvedEndpoints = {
  readonly fromEntityId: string;
  readonly toEntityId: string;
};

const RELATIONSHIP_TYPE_SET = new Set<string>(RELATIONSHIP_TYPES);

function isRelationshipType(value: string): value is RelationshipType {
  return RELATIONSHIP_TYPE_SET.has(value);
}

function dedupKey(entityA: string, entityB: string, type: RelationshipType): string {
  return `${entityA}|${entityB}|${type}`;
}

/** Avoid a generic mention edge when a more specific relationship already connects the pair. */
function unorderedPairKey(entityA: string, entityB: string): string {
  const [left, right] = entityA < entityB ? [entityA, entityB] : [entityB, entityA];
  return `${left}|${right}`;
}

function relationshipId(fromEntityId: string, type: RelationshipType, toEntityId: string): string {
  return `rel_${fromEntityId}_${type}_${toEntityId}`;
}

function resolveEvidenceIds(
  fromEntity: CatalogEntityForRelationships | undefined,
  type: RelationshipType,
  targetId: string,
): readonly string[] {
  if (!fromEntity) return [];
  return (fromEntity.claims ?? []).flatMap((claim, index) => {
    if (claim.predicate !== type || claim.object !== targetId || !claim.id || !claim.citationHref)
      return [];
    try {
      if (!['http:', 'https:'].includes(new URL(claim.citationHref).protocol)) return [];
    } catch {
      return [];
    }
    return [resolveReleaseClaimId(fromEntity, claim, index)];
  });
}

function endpointsFromCatalogEntry(
  entityId: string,
  entry: CatalogRelatedEntry,
): ResolvedEndpoints {
  if (entry.direction === 'outgoing') {
    return { fromEntityId: entityId, toEntityId: entry.id };
  }
  return { fromEntityId: entry.id, toEntityId: entityId };
}

/**
 * Deduplicates bidirectional fixture pairs into one `EntityRelationship` each.
 * Outgoing uses from=entity, to=related.id; incoming uses the reversed endpoints.
 * Opposite directed assertions and distinct predicates remain separate.
 */
export function extractCatalogRelationships(
  entities: readonly CatalogEntityForRelationships[],
  options: ExtractCatalogRelationshipsOptions,
): ExtractCatalogRelationshipsResult {
  const entityById = new Map<string, CatalogEntityForRelationships>();
  for (const entity of entities) {
    entityById.set(entity.id, entity);
  }

  const skipped: string[] = [];
  const canonicalByKey = new Map<
    string,
    { readonly endpoints: ResolvedEndpoints; readonly timespan?: TemporalContext }
  >();

  const sortedEntities = [...entities].sort((a, b) => a.id.localeCompare(b.id));

  for (const entity of sortedEntities) {
    for (const entry of entity.related ?? []) {
      if (!isRelationshipType(entry.type)) {
        skipped.push(`${entity.id} -> ${entry.id}: unsupported relationship type "${entry.type}"`);
        continue;
      }
      if (!entityById.has(entry.id)) {
        skipped.push(`${entity.id} -> ${entry.id}: related entity not found in input set`);
        continue;
      }

      const endpoints = endpointsFromCatalogEntry(entity.id, entry);
      const key = dedupKey(endpoints.fromEntityId, endpoints.toEntityId, entry.type);
      const existing = canonicalByKey.get(key);

      if (entry.direction === 'outgoing') {
        canonicalByKey.set(key, {
          endpoints,
          ...(entry.timespan ? { timespan: entry.timespan } : {}),
        });
        continue;
      }

      if (!existing) {
        canonicalByKey.set(key, {
          endpoints,
          ...(entry.timespan ? { timespan: entry.timespan } : {}),
        });
      }
    }
  }

  // Pairs already expressed by an explicit `related[]` edge (of ANY type) — computed from the
  // explicit pass above, BEFORE any mention-derived edges are added, so a mention never shadows
  // or duplicates a specific already-authored edge (e.g. `founded`) with a generic `related_to`.
  const explicitPairKeys = new Set<string>();
  for (const canonical of canonicalByKey.values()) {
    explicitPairKeys.add(
      unorderedPairKey(canonical.endpoints.fromEntityId, canonical.endpoints.toEntityId),
    );
  }

  // Additive wiring of `mentionedEntityIds` (see this module's header comment). An entity that
  // carries no `mentionedEntityIds` contributes nothing here.
  const mentionIndex = buildMentionResolverIndex(entities);
  for (const entity of sortedEntities) {
    for (const token of entity.mentionedEntityIds ?? []) {
      const resolvedId = resolveMentionToken(token, mentionIndex);
      if (!resolvedId) continue; // Unresolved references cannot establish an edge.
      if (resolvedId === entity.id) continue; // self-loop.
      if (!entityById.has(resolvedId)) continue; // defensive: resolver already restricts to this set.
      if (explicitPairKeys.has(unorderedPairKey(entity.id, resolvedId))) continue; // already an edge.

      const key = dedupKey(entity.id, resolvedId, 'related_to');
      if (canonicalByKey.has(key)) continue; // another mention already produced this same edge.

      canonicalByKey.set(key, {
        endpoints: { fromEntityId: entity.id, toEntityId: resolvedId },
      });
    }
  }

  const relationships: EntityRelationship[] = [];

  for (const [key, canonical] of [...canonicalByKey.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const type = key.split('|').at(-1) as RelationshipType;
    const fromEntity = entityById.get(canonical.endpoints.fromEntityId);
    const evidenceIds = resolveEvidenceIds(fromEntity, type, canonical.endpoints.toEntityId);

    if (evidenceIds.length === 0) {
      skipped.push(
        `${canonical.endpoints.fromEntityId} -> ${canonical.endpoints.toEntityId} (${type}): no exact cited relationship claim`,
      );
      continue;
    }

    relationships.push({
      id: relationshipId(canonical.endpoints.fromEntityId, type, canonical.endpoints.toEntityId),
      fromEntityId: canonical.endpoints.fromEntityId,
      toEntityId: canonical.endpoints.toEntityId,
      type,
      evidenceIds,
      ...(canonical.timespan ? { temporal: canonical.timespan } : {}),
      createdAt: options.generatedAt,
      updatedAt: options.generatedAt,
      workflowStatus: 'accepted',
      publicationStatus: 'published',
      resolutionState: 'resolved',
    });
  }

  return { relationships, skipped };
}

/** Projects canonical relationships into public related entries per entity id. */
export function relatedEntriesFromRelationships(
  entityIds: readonly string[],
  relationships: readonly EntityRelationship[],
): ReadonlyMap<string, readonly PublicRelatedEntry[]> {
  const adjacencyByEntity = buildAllEntityAdjacency(entityIds, relationships);
  const result = new Map<string, readonly PublicRelatedEntry[]>();
  for (const [entityId, adjacency] of adjacencyByEntity) {
    result.set(entityId, toPublicRelatedEntries(adjacency));
  }
  return result;
}
