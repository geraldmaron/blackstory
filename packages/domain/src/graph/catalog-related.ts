/**
 * Converts national-catalog inline `related` shortcuts into canonical
 * `EntityRelationship` records and projects relationships back to public
 * adjacency entries for release materialization.
 *
 * Also wires forward each entity's `mentionedEntityIds` (WS6 — see `./mention-resolver.ts`'s
 * header comment for why those tokens are a mixed bag of already-canonical ids, bare acronyms,
 * and event slugs). A resolved mention becomes a minimal `related_to` edge only — it is
 * deliberately NOT typed any more specifically than that. Specific edge typing (e.g. `member_of`,
 * `attended`, `participated_in`) is the candidate/proposal pipeline's job
 * (`./relationship-candidates.ts` + `packages/firebase/scripts/generate-relationship-candidates.ts`
 * stage 2), which has the context to assign a real type per `docs/relationship-taxonomy.md` and
 * route through human review before publication. This extraction path publishes directly
 * (`workflowStatus: 'accepted'`), so it only ever emits the one edge type that's true by
 * construction: "these two entities are documented as related."
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
  /** Slug/acronym/already-canonical-id tokens naming other entities this entity's catalog prose
   * mentions — see this module's header comment and `./mention-resolver.ts`. */
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
  const [left, right] = entityA < entityB ? [entityA, entityB] : [entityB, entityA];
  return `${left}|${right}|${type}`;
}

/** Same pairing as `dedupKey` but WITHOUT the relationship type — used to detect that two
 * endpoints already have SOME explicit `related[]` edge between them (of any type), so a
 * resolved-mention `related_to` edge never duplicates an already-authored, more specific edge. */
function unorderedPairKey(entityA: string, entityB: string): string {
  const [left, right] = entityA < entityB ? [entityA, entityB] : [entityB, entityA];
  return `${left}|${right}`;
}

function relationshipId(fromEntityId: string, type: RelationshipType, toEntityId: string): string {
  return `rel_${fromEntityId}_${type}_${toEntityId}`;
}

function resolveEntityClaimIds(entity: CatalogEntityForRelationships): readonly string[] {
  return (entity.claims ?? []).map((claim, index) => resolveReleaseClaimId(entity, claim, index));
}

function resolveEvidenceIds(
  fromEntity: CatalogEntityForRelationships | undefined,
  toEntity: CatalogEntityForRelationships | undefined,
): readonly string[] {
  const fromClaimIds = fromEntity ? resolveEntityClaimIds(fromEntity) : [];
  if (fromClaimIds.length > 0) {
    const toClaimIds = toEntity ? resolveEntityClaimIds(toEntity) : [];
    return [...new Set([...fromClaimIds, ...toClaimIds])];
  }
  const toClaimIds = toEntity ? resolveEntityClaimIds(toEntity) : [];
  return toClaimIds;
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
 * Direction semantics: outgoing uses from=entity, to=related.id; incoming uses
 * from=related.id, to=entity. Canonical direction prefers the first-seen outgoing
 * edge; otherwise the first incoming edge with endpoints flipped to match adjacency.
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
        skipped.push(
          `${entity.id} -> ${entry.id}: unsupported relationship type "${entry.type}"`,
        );
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

  // Additive, backward-compatible wiring of `mentionedEntityIds` (WS6 — see this module's header
  // comment). Entities that carry no `mentionedEntityIds` behave exactly as before this pass.
  const mentionIndex = buildMentionResolverIndex(entities);
  for (const entity of sortedEntities) {
    for (const token of entity.mentionedEntityIds ?? []) {
      const resolvedId = resolveMentionToken(token, mentionIndex);
      if (!resolvedId) continue; // unresolved mention: never guessed, silently skipped.
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

  for (const [key, canonical] of [...canonicalByKey.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const type = key.split('|').at(-1) as RelationshipType;
    const fromEntity = entityById.get(canonical.endpoints.fromEntityId);
    const toEntity = entityById.get(canonical.endpoints.toEntityId);
    const evidenceIds = resolveEvidenceIds(fromEntity, toEntity);

    if (evidenceIds.length === 0) {
      skipped.push(
        `${canonical.endpoints.fromEntityId} -> ${canonical.endpoints.toEntityId} (${type}): no resolvable claim evidence`,
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
