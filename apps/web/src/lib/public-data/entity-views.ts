/**
 * The entity read model, free of Next and React: raw projections in, hydrated `PublicEntityView`s out.
 * Extracted from `source.ts` so apps/web and apps/site run ONE implementation of citation retention,
 * learning-link hydration and the bounded 1-3 hop neighborhood read. `source.ts` keeps the caching
 * (React `cache`, the release-scoped cache); apps/site keeps its own (apps/site/src/server/data).
 */
import type { PublicEntityProjectionDoc } from '@repo/schemas';
import { relatedEntriesFromRelationships } from '@repo/domain';
import {
  buildRelatedNeighborStubs,
  buildRelationshipGraph,
  composeContinueLearningStubs,
  type RelationshipGraphLookup,
} from '@repo/domain/learning-index';
import type { PublicEntityView, RelatedNeighborView } from '../../data/public-seed';
import { buildGraphTimeline, isUndatedTimelineEntry } from '../../data/entity-graph-seed';
import { parseEntityProjection } from './projection-contracts';
import { mapProjectionToPublicEntityView, type PublicProjectionInput } from './map-projection';
import { resolveHistoryRelationships } from '../history/resolve-history-relationships';
import {
  collectOneHopNeighborIds,
  collectThreeHopNeighborIds,
  collectTwoHopNeighborIds,
} from './neighbor-ids';

export function toNeighborLookup(entity: PublicEntityView): RelationshipGraphLookup {
  return {
    id: entity.id,
    displayName: entity.displayName,
    kind: entity.kind,
    summary: entity.summary,
    ...(entity.related !== undefined ? { related: entity.related } : {}),
    // Era buckets are the relationship map's fallback date when an edge carries no timespan of
    // its own. Unused by the 1-hop/2-hop stub composers, which ignore extra lookup fields.
    ...(entity.eraBuckets !== undefined ? { eraBuckets: entity.eraBuckets } : {}),
  };
}

export function asRelatedNeighborViews(
  stubs: ReturnType<typeof buildRelatedNeighborStubs>,
): readonly RelatedNeighborView[] {
  return stubs.map((stub) => ({
    id: stub.id,
    displayName: stub.displayName,
    kind: stub.kind,
    summary: stub.summary,
    relationType: stub.relationType,
    direction: stub.direction,
    ...(stub.timespan !== undefined ? { timespan: stub.timespan } : {}),
    ...(stub.viaEvent !== undefined ? { viaEvent: stub.viaEvent } : {}),
  }));
}

/**
 * Prebuilt per-catalog lookups keep whole-catalog hydration linear. They are created once by
 * `mapProjectionsToHydratedViews` and shared across every entity in the pass.
 */
export type CatalogLookups = {
  readonly neighborsById: Map<string, RelationshipGraphLookup>;
  readonly displayNameById: Map<string, { readonly displayName: string }>;
};

export function buildCatalogLookups(catalog: readonly PublicEntityView[]): CatalogLookups {
  const neighborsById = new Map<string, RelationshipGraphLookup>();
  const displayNameById = new Map<string, { readonly displayName: string }>();
  for (const item of catalog) {
    neighborsById.set(item.id, toNeighborLookup(item));
    displayNameById.set(item.id, { displayName: item.displayName });
  }
  return { neighborsById, displayNameById };
}

/**
 * Replace authored relationship candidates with adjacency backed by an exact cited claim.
 *
 * Release projections can still contain legacy `related[]` candidates. They are useful for
 * bounded neighbor reads, but they are not publication authority. The history graph adapter
 * owns conversion to the domain relationship extractor, so every public surface applies the
 * same predicate, target, citation and direction gate.
 */
export function retainCitedRelationshipViews(
  entities: readonly PublicEntityView[],
): readonly PublicEntityView[] {
  const relationships = resolveHistoryRelationships(
    entities,
    entities.find((entity) => entity.revision.generatedAt.length > 0)?.revision.generatedAt ??
      '1970-01-01T00:00:00.000Z',
  );
  const relatedByEntityId = relatedEntriesFromRelationships(
    entities.map((entity) => entity.id),
    relationships,
  );

  return entities.map((entity) => {
    const related = relatedByEntityId.get(entity.id) ?? [];
    return {
      ...entity,
      related,
      relatedIds: related.map((entry) => entry.id),
    };
  });
}

/** Attach 1-hop stubs + capped 2-hop continue-learning using a neighbor catalog.
 * Also composes the dated timeline once neighbor display names are resolvable.
 *
 * `lookups` is an optional optimization for whole-catalog passes: when omitted the maps are
 * built from `catalog` (correct, but O(catalog) per call — fine for the single-entity path
 * where the catalog is the entity plus its bounded neighbors). Callers that hydrate every
 * entity in a catalog MUST pass shared lookups or the pass degrades to O(n²). */
export function hydrateEntityLearningLinks(
  entity: PublicEntityView,
  catalog: readonly PublicEntityView[],
  lookups?: CatalogLookups,
): PublicEntityView {
  const shared = lookups ?? buildCatalogLookups(catalog);

  // The entity's own record must win over any catalog copy, but must not leak into the shared
  // maps (they are reused across sibling entities in a whole-catalog pass). Snapshot and restore.
  const hadNeighbor = shared.neighborsById.has(entity.id);
  const priorNeighbor = shared.neighborsById.get(entity.id);
  shared.neighborsById.set(entity.id, toNeighborLookup(entity));

  const relatedNeighbors = asRelatedNeighborViews(
    buildRelatedNeighborStubs(entity.related, shared.neighborsById),
  );
  const continueLearning = asRelatedNeighborViews(
    composeContinueLearningStubs(entity.id, relatedNeighbors, shared.neighborsById),
  );
  // Path-preserving 3-hop walk for the record room's relationship map. Shares the catalog the
  // stub composers already use, so a whole-catalog pass costs no extra reads; the single-entity
  // path pays for its third ring once, in `loadLiveEntity`.
  const relationshipGraph = buildRelationshipGraph(entity.id, shared.neighborsById);

  if (hadNeighbor && priorNeighbor !== undefined) {
    shared.neighborsById.set(entity.id, priorNeighbor);
  } else if (!hadNeighbor) {
    shared.neighborsById.delete(entity.id);
  }

  // Prefer already-hydrated neighbor stubs when the catalog is thin (single-entity path).
  // Overlay entries are tracked so the shared map is left exactly as it was found.
  const hadDisplayName = shared.displayNameById.has(entity.id);
  const priorDisplayName = shared.displayNameById.get(entity.id);
  shared.displayNameById.set(entity.id, { displayName: entity.displayName });
  const overlaidIds: string[] = [];
  for (const neighbor of relatedNeighbors) {
    if (!shared.displayNameById.has(neighbor.id)) {
      shared.displayNameById.set(neighbor.id, { displayName: neighbor.displayName });
      overlaidIds.push(neighbor.id);
    }
  }

  const timeline = buildGraphTimeline(entity, shared.displayNameById).filter(
    (item) => !isUndatedTimelineEntry(item),
  );

  for (const id of overlaidIds) shared.displayNameById.delete(id);
  if (hadDisplayName && priorDisplayName !== undefined) {
    shared.displayNameById.set(entity.id, priorDisplayName);
  } else if (!hadDisplayName) {
    shared.displayNameById.delete(entity.id);
  }

  return {
    ...entity,
    timeline,
    ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : {}),
    ...(continueLearning.length > 0 ? { continueLearning } : {}),
    ...(relationshipGraph.nodes.length > 0 ? { relationshipGraph } : {}),
  };
}

export function mapProjectionsToHydratedViews(
  projections: readonly PublicEntityProjectionDoc[],
): readonly PublicEntityView[] {
  const mapped = retainCitedRelationshipViews(
    projections.map((projection) =>
      mapProjectionToPublicEntityView(projection as PublicProjectionInput),
    ),
  );
  const lookups = buildCatalogLookups(mapped);
  return mapped.map((entity) => hydrateEntityLearningLinks(entity, mapped, lookups));
}

export function projectionsFromArtifactEntities(
  entities: readonly unknown[],
): PublicEntityProjectionDoc[] {
  const out: PublicEntityProjectionDoc[] = [];
  for (const entity of entities) {
    const parsed = parseEntityProjection(entity);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** The two point reads and the log sink the neighborhood walk needs. */
export type NeighborhoodReaders = {
  readonly fetchProjection: (
    releaseId: string,
    entityId: string,
  ) => Promise<PublicEntityProjectionDoc | undefined>;
  readonly fetchProjectionsByIds: (
    releaseId: string,
    entityIds: readonly string[],
  ) => Promise<readonly PublicEntityProjectionDoc[]>;
  readonly warn: (message: string) => void;
};

/**
 * Thin batched shape for card/list surfaces: citation retention only, no neighbor expansion.
 */
export function thinViewsFromProjections(
  projections: readonly PublicEntityProjectionDoc[],
): readonly PublicEntityView[] {
  return retainCitedRelationshipViews(
    projections.map((item) => mapProjectionToPublicEntityView(item as PublicProjectionInput)),
  );
}

/**
 * Single-entity path: point-read the entity and bounded relationship candidates without loading the
 * full release catalog. Entity pages use this; story/list cards use `thinViewsFromProjections`.
 */
export async function loadEntityNeighborhood(
  releaseId: string,
  entityId: string,
  readers: NeighborhoodReaders,
): Promise<PublicEntityView | undefined> {
  const projection = await readers.fetchProjection(releaseId, entityId);
  if (!projection) return undefined;
  const rawEntity = mapProjectionToPublicEntityView(projection as PublicProjectionInput);

  try {
    // Candidate edges bound the point reads. Only exact cited edges from each completed batch
    // are allowed to select the next ring.
    const oneHopCandidateIds = collectOneHopNeighborIds(rawEntity);
    const oneHopProjections =
      oneHopCandidateIds.length > 0
        ? await readers.fetchProjectionsByIds(releaseId, oneHopCandidateIds)
        : [];
    let projections = [projection, ...oneHopProjections];
    let rawViews = projections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    let citedViews = retainCitedRelationshipViews(rawViews);
    let citedById = new Map(citedViews.map((item) => [item.id, item]));
    const oneHopIds = collectOneHopNeighborIds(citedById.get(entityId) ?? rawEntity);
    const rawById = new Map(rawViews.map((item) => [item.id, item]));
    const oneHopRawViews = oneHopIds.flatMap((id) => {
      const item = rawById.get(id);
      return item ? [item] : [];
    });
    const twoHopCandidateIds = collectTwoHopNeighborIds(entityId, oneHopIds, oneHopRawViews);
    const twoHopProjections =
      twoHopCandidateIds.length > 0
        ? await readers.fetchProjectionsByIds(releaseId, twoHopCandidateIds)
        : [];
    projections = [...projections, ...twoHopProjections];
    rawViews = projections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    citedViews = retainCitedRelationshipViews(rawViews);
    citedById = new Map(citedViews.map((item) => [item.id, item]));
    const citedEntity = citedById.get(entityId);
    const validatedOneHopIds = citedEntity ? collectOneHopNeighborIds(citedEntity) : [];
    const validatedOneHopViews = validatedOneHopIds.flatMap((id) => {
      const item = citedById.get(id);
      return item ? [item] : [];
    });
    const twoHopIds = collectTwoHopNeighborIds(entityId, validatedOneHopIds, validatedOneHopViews);
    const expandedRawById = new Map(rawViews.map((item) => [item.id, item]));
    const twoHopRawViews = twoHopIds.flatMap((id) => {
      const item = expandedRawById.get(id);
      return item ? [item] : [];
    });
    // Third-ring candidates come only from independently evidenced second-hop nodes. This is
    // one bounded batch for the relationship map, never a release-catalog scan.
    const threeHopCandidateIds = collectThreeHopNeighborIds(
      [entityId, ...validatedOneHopIds, ...twoHopIds],
      twoHopRawViews,
    );
    const threeHopProjections =
      threeHopCandidateIds.length > 0
        ? await readers.fetchProjectionsByIds(releaseId, threeHopCandidateIds)
        : [];
    const catalog = retainCitedRelationshipViews([
      ...rawViews,
      ...threeHopProjections.map((item) =>
        mapProjectionToPublicEntityView(item as PublicProjectionInput),
      ),
    ]);
    const entity = catalog.find((item) => item.id === entityId);
    return entity ? hydrateEntityLearningLinks(entity, catalog) : undefined;
  } catch (error) {
    // Never expose an unverified candidate or mix bundled seed neighbors into a live entity.
    const message = error instanceof Error ? error.message : String(error);
    readers.warn(
      `[public-data] neighbor batch failed for ${entityId}; hydrating without seed catalog: ${message}`,
    );
    const [entity] = retainCitedRelationshipViews([rawEntity]);
    return entity ? hydrateEntityLearningLinks(entity, [entity]) : undefined;
  }
}
