/**
 * Public data source selector: live release artifacts + Firestore with seed snapshot fallback.
 * Hydrates 1-hop related neighbor stubs and composes capped 2-hop continue-learning on entity
 * pages only. List/map/search/stories prefer ADR-004 catalog artifacts (when present) then
 * process-local TTL + size-gated `unstable_cache`. The `/stories` index caches field-masked
 * list items (no body). Story detail related rails use a thin batched point-get
 * (`listPublicEntityViewsByIds`) — never the 2-hop learning graph.
 * Oversized live catalogs (>~1.8MB) stay in process memory only; Next's 2MB data-cache limit
 * must not receive the fat array (console warn + repeated origin fetches).
 */

import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import type {
  PublicEntityProjectionDoc,
  PublicSearchIndexDoc as FirestoreSearchIndexDoc,
  PublicStoryListItemDoc,
  PublicStoryProjectionDoc,
} from '@repo/firebase';
import {
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  type NeighborLookup,
} from '@repo/domain/learning-index';
import {
  getPublicEntity,
  listPublicEntities,
  type PublicEntityView,
  type RelatedNeighborView,
} from '../../data/public-seed';
import {
  isPublicReadApiDisabled,
  resolvePublicEntity,
  type PublicReadResult,
  type PublicReadSource,
} from '../runtime-hardening/degraded-mode';
import { getSnapshotSearchIndex } from '../search/snapshot-search-index';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  fetchPublicEntityProjectionsByIds,
  fetchPublicStoryProjection,
  getSnapshotStoryProjection,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  listPublicStoryProjections,
  listPublicStorySummaries,
  listSnapshotStoryListItems,
  listSnapshotStoryProjections,
  parseEntityProjection,
  parseSearchIndexDoc,
  shouldUseLivePublicProjections,
} from './firestore-readers';
import {
  createLiveCatalogMemoryCache,
  isOversizedLiveCatalogSentinel,
  liveCatalogCacheKey,
  nextDataCacheValueForCatalog,
  type LiveCatalogKind,
  type LiveCatalogMemoryCache,
} from './live-catalog-cache';
import { mapProjectionToPublicEntityView, type PublicProjectionInput } from './map-projection';
import { mapFirestoreSearchIndexDoc } from './map-search-index';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids';
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
} from './release-artifacts';

export type { PublicReadSource };

/** Cross-request cache window for release catalog / search index / stories (seconds). */
const RELEASE_CATALOG_REVALIDATE_SECONDS = 300;
const RELEASE_CATALOG_TTL_MS = RELEASE_CATALOG_REVALIDATE_SECONDS * 1000;

/** Process-local store for public release catalogs (never private/research docs). */
const liveEntitiesMemory = createLiveCatalogMemoryCache<readonly PublicEntityView[]>({
  defaultTtlMs: RELEASE_CATALOG_TTL_MS,
});
const liveSearchIndexMemory = createLiveCatalogMemoryCache<readonly PublicSearchIndexDoc[]>({
  defaultTtlMs: RELEASE_CATALOG_TTL_MS,
});
/** Thin story list cards only — never full `body[]` prose. */
const liveStoriesMemory = createLiveCatalogMemoryCache<readonly PublicStoryListItemDoc[]>({
  defaultTtlMs: RELEASE_CATALOG_TTL_MS,
});

/** One active-release pointer read per request (shared across entities/stories/search). */
const getCachedActiveRelease = cache(fetchActiveRelease);

function toNeighborLookup(entity: PublicEntityView): NeighborLookup {
  return {
    id: entity.id,
    displayName: entity.displayName,
    kind: entity.kind,
    summary: entity.summary,
    ...(entity.related !== undefined ? { related: entity.related } : {}),
  };
}

function asRelatedNeighborViews(
  stubs: ReturnType<typeof buildRelatedNeighborStubs>,
): readonly RelatedNeighborView[] {
  return stubs.map((stub) =>
    stub.timespan !== undefined
      ? {
          id: stub.id,
          displayName: stub.displayName,
          kind: stub.kind,
          summary: stub.summary,
          relationType: stub.relationType,
          direction: stub.direction,
          timespan: stub.timespan,
        }
      : {
          id: stub.id,
          displayName: stub.displayName,
          kind: stub.kind,
          summary: stub.summary,
          relationType: stub.relationType,
          direction: stub.direction,
        },
  );
}

/** Attach 1-hop stubs + capped 2-hop continue-learning using a neighbor catalog. */
export function hydrateEntityLearningLinks(
  entity: PublicEntityView,
  catalog: readonly PublicEntityView[],
): PublicEntityView {
  const neighborsById = new Map(catalog.map((item) => [item.id, toNeighborLookup(item)]));
  neighborsById.set(entity.id, toNeighborLookup(entity));

  const relatedNeighbors = asRelatedNeighborViews(
    buildRelatedNeighborStubs(entity.related, neighborsById),
  );
  const continueLearning = asRelatedNeighborViews(
    composeContinueLearningStubs(entity.id, relatedNeighbors, neighborsById),
  );

  return {
    ...entity,
    ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : {}),
    ...(continueLearning.length > 0 ? { continueLearning } : {}),
  };
}

function mapProjectionsToHydratedViews(
  projections: readonly PublicEntityProjectionDoc[],
): readonly PublicEntityView[] {
  const mapped = projections.map((projection) =>
    mapProjectionToPublicEntityView(projection as PublicProjectionInput),
  );
  return mapped.map((entity) => hydrateEntityLearningLinks(entity, mapped));
}

function projectionsFromArtifactEntities(
  entities: readonly unknown[],
): PublicEntityProjectionDoc[] {
  const out: PublicEntityProjectionDoc[] = [];
  for (const entity of entities) {
    const parsed = parseEntityProjection(entity);
    if (parsed) out.push(parsed);
  }
  return out;
}

function searchDocsFromArtifact(docs: readonly unknown[]): PublicSearchIndexDoc[] {
  const out: PublicSearchIndexDoc[] = [];
  for (const doc of docs) {
    const parsed = parseSearchIndexDoc(doc);
    if (parsed) out.push(mapFirestoreSearchIndexDoc(parsed));
  }
  return out;
}

async function loadLiveEntitiesForRelease(
  releaseId: string,
): Promise<readonly PublicEntityView[] | undefined> {
  const artifact = await fetchReleaseEntitiesListArtifact(releaseId);
  if (artifact && artifact.entities.length > 0) {
    const projections = projectionsFromArtifactEntities(artifact.entities);
    if (projections.length > 0) return mapProjectionsToHydratedViews(projections);
  }

  const projections = await listPublicEntityProjections(releaseId);
  if (projections.length === 0) return undefined;
  return mapProjectionsToHydratedViews(projections);
}

async function loadLiveSearchIndexForRelease(
  releaseId: string,
): Promise<readonly PublicSearchIndexDoc[] | undefined> {
  const artifact = await fetchReleaseSearchIndexArtifact(releaseId);
  if (artifact && artifact.docs.length > 0) {
    const mapped = searchDocsFromArtifact(artifact.docs);
    if (mapped.length > 0) return mapped;
  }

  const firestoreDocs = await listPublicSearchIndexDocs(releaseId);
  if (firestoreDocs.length > 0) {
    return firestoreDocs.map((doc: FirestoreSearchIndexDoc) => mapFirestoreSearchIndexDoc(doc));
  }
  return undefined;
}

/**
 * Load a live catalog with process-local TTL for fat payloads and size-gated Next data cache.
 * When the serialized catalog exceeds the safe ceiling, Next stores only a tiny oversized
 * sentinel (never the full array) so SET no longer warns and every instance still fills memory.
 */
async function cacheLiveCatalog<T>(options: {
  readonly kind: LiveCatalogKind;
  readonly releaseId: string;
  readonly activatedAt: string;
  readonly memory: LiveCatalogMemoryCache<T>;
  readonly load: () => Promise<T | undefined>;
  readonly nextCacheKeyPrefix: string;
}): Promise<T | undefined> {
  const memKey = liveCatalogCacheKey(options.kind, options.releaseId, options.activatedAt);
  const memoryHit = options.memory.get(memKey);
  if (memoryHit !== undefined) {
    return memoryHit;
  }

  const fromNext = await unstable_cache(
    async () => {
      const loaded = await options.load();
      if (loaded === undefined) {
        return undefined;
      }
      const forNext = nextDataCacheValueForCatalog(loaded);
      if (isOversizedLiveCatalogSentinel(forNext)) {
        options.memory.set(memKey, loaded);
      }
      return forNext;
    },
    [options.nextCacheKeyPrefix, options.releaseId, options.activatedAt],
    { revalidate: RELEASE_CATALOG_REVALIDATE_SECONDS },
  )();

  if (isOversizedLiveCatalogSentinel(fromNext)) {
    const afterFactory = options.memory.get(memKey);
    if (afterFactory !== undefined) {
      return afterFactory;
    }
    const loaded = await options.load();
    if (loaded !== undefined) {
      options.memory.set(memKey, loaded);
    }
    return loaded;
  }

  if (fromNext !== undefined) {
    options.memory.set(memKey, fromNext);
  }
  return fromNext;
}

function cachedLiveEntities(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicEntityView[] | undefined> {
  return cacheLiveCatalog({
    kind: 'entities',
    releaseId,
    activatedAt,
    memory: liveEntitiesMemory,
    load: () => loadLiveEntitiesForRelease(releaseId),
    nextCacheKeyPrefix: 'public-release-entities',
  });
}

function cachedLiveSearchIndex(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicSearchIndexDoc[] | undefined> {
  return cacheLiveCatalog({
    kind: 'search-index',
    releaseId,
    activatedAt,
    memory: liveSearchIndexMemory,
    load: () => loadLiveSearchIndexForRelease(releaseId),
    nextCacheKeyPrefix: 'public-release-search-index',
  });
}

function cachedLiveStoryListItems(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicStoryListItemDoc[] | undefined> {
  return cacheLiveCatalog({
    kind: 'stories',
    releaseId,
    activatedAt,
    memory: liveStoriesMemory,
    load: async () => {
      const stories = await listPublicStorySummaries(releaseId);
      return stories.length > 0 ? stories : undefined;
    },
    nextCacheKeyPrefix: 'public-release-stories',
  });
}

async function loadLiveEntities(): Promise<readonly PublicEntityView[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  return cachedLiveEntities(active.releaseId, active.activatedAt);
}

/**
 * Live single-entity path: point-get the entity + bounded related/2-hop neighbors.
 * Must not full-scan `publicReleases/{id}/entities` (that was ~N reads per entity page).
 * Entity pages only — story/list cards use `listPublicEntityViewsByIds` instead.
 */
async function loadLiveEntity(entityId: string): Promise<PublicEntityView | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  const projection = await fetchPublicEntityProjection(active.releaseId, entityId);
  if (!projection) return undefined;
  const entity = mapProjectionToPublicEntityView(projection as PublicProjectionInput);

  try {
    const oneHopIds = collectOneHopNeighborIds(entity);
    const oneHopProjections = await fetchPublicEntityProjectionsByIds(active.releaseId, oneHopIds);
    const oneHopViews = oneHopProjections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    const twoHopIds = collectTwoHopNeighborIds(entityId, oneHopIds, oneHopViews);
    const twoHopProjections = await fetchPublicEntityProjectionsByIds(active.releaseId, twoHopIds);
    const twoHopViews = twoHopProjections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    const catalog = [entity, ...oneHopViews, ...twoHopViews];
    return hydrateEntityLearningLinks(entity, catalog);
  } catch {
    return hydrateEntityLearningLinks(entity, [...listPublicEntities(), entity]);
  }
}

/**
 * Thin batched entity load for card/list surfaces (story related rails). One active-release
 * read + one `getAll` for the requested ids — no 1-hop/2-hop neighbor expansion.
 */
async function loadLiveEntitiesByIdsThin(
  entityIds: readonly string[],
): Promise<readonly PublicEntityView[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  const projections = await fetchPublicEntityProjectionsByIds(active.releaseId, entityIds);
  if (projections.length === 0) return undefined;
  return projections.map((item) => mapProjectionToPublicEntityView(item as PublicProjectionInput));
}

/** Resolve one entity: live projection first, then bundled seed snapshot.  */
export const resolvePublicEntityView = cache(async function resolvePublicEntityView(
  entityId: string,
): Promise<PublicReadResult<PublicEntityView>> {
  return resolvePublicEntity(entityId, () => loadLiveEntity(entityId));
});

/** List entities from live release artifacts/cache, falling back to seed.  */
export const listPublicEntityViews = cache(async function listPublicEntityViews(): Promise<{
  readonly data: readonly PublicEntityView[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: listPublicEntities(), source: 'snapshot' };
  }

  try {
    const live = await loadLiveEntities();
    if (live !== undefined) {
      return { data: live, source: 'live' };
    }
  } catch {
    // fall through
  }

  return { data: listPublicEntities(), source: 'snapshot' };
});

/**
 * Search index: prefer release search-index artifact, then Firestore `publicSearchIndex`,
 * then bundled seed. Never rebuilds from a full entity projection scan when live index exists.
 */
export const getPublicSearchIndex = cache(async function getPublicSearchIndex(): Promise<{
  readonly data: readonly PublicSearchIndexDoc[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: getSnapshotSearchIndex(), source: 'snapshot' };
  }

  try {
    if (shouldUseLivePublicProjections()) {
      const active = await getCachedActiveRelease();
      if (active) {
        const live = await cachedLiveSearchIndex(active.releaseId, active.activatedAt);
        if (live !== undefined && live.length > 0) {
          return { data: live, source: 'live' };
        }
      }
    }
  } catch {
    // fall through
  }

  return { data: getSnapshotSearchIndex(), source: 'snapshot' };
});

/**
 * Batched entity cards for non-entity pages (story related rails). Dedupes + sorts ids for a
 * stable `React.cache` key (arrays are reference-unstable), then reorders to request order.
 * Never runs learning-graph hydration.
 */
const listPublicEntityViewsByIdsCached = cache(async function listPublicEntityViewsByIdsCached(
  stableIdsKey: string,
): Promise<{
  readonly byId: ReadonlyMap<string, PublicEntityView>;
  readonly source: PublicReadSource;
}> {
  const unique =
    stableIdsKey.length === 0 ? ([] as string[]) : stableIdsKey.split('\u0001').filter(Boolean);

  function fromSnapshot(): ReadonlyMap<string, PublicEntityView> {
    const map = new Map<string, PublicEntityView>();
    for (const id of unique) {
      const entity = getPublicEntity(id);
      if (entity) map.set(id, entity);
    }
    return map;
  }

  if (unique.length === 0) {
    return { byId: new Map(), source: 'none' };
  }

  if (isPublicReadApiDisabled()) {
    return { byId: fromSnapshot(), source: 'snapshot' };
  }

  try {
    const live = await loadLiveEntitiesByIdsThin(unique);
    if (live !== undefined && live.length > 0) {
      const byId = new Map(live.map((entity) => [entity.id, entity] as const));
      for (const id of unique) {
        if (!byId.has(id)) {
          const seed = getPublicEntity(id);
          if (seed) byId.set(id, seed);
        }
      }
      return { byId, source: 'live' };
    }
  } catch {
    // fall through
  }

  return { byId: fromSnapshot(), source: 'snapshot' };
});

export async function listPublicEntityViewsByIds(
  entityIds: readonly string[],
): Promise<{
  readonly data: readonly PublicEntityView[];
  readonly source: PublicReadSource;
}> {
  const requestOrder = [
    ...new Set(entityIds.map((id) => id.trim()).filter((id) => id.length > 0)),
  ];
  if (requestOrder.length === 0) {
    return { data: [], source: 'none' };
  }

  const stableIdsKey = [...requestOrder].sort().join('\u0001');
  const { byId, source } = await listPublicEntityViewsByIdsCached(stableIdsKey);
  const ordered: PublicEntityView[] = [];
  for (const id of requestOrder) {
    const hit = byId.get(id);
    if (hit) ordered.push(hit);
  }
  return { data: ordered, source };
}

/** Sync helpers for call sites that still need seed during static generation.  */
export function getSeedPublicEntity(entityId: string): PublicEntityView | undefined {
  return getPublicEntity(entityId);
}

export function listSeedPublicEntities(): readonly PublicEntityView[] {
  return listPublicEntities();
}

export type PublicStoryView = PublicStoryProjectionDoc;
export type PublicStoryListItem = PublicStoryListItemDoc;

async function loadLiveStoryListItems(): Promise<readonly PublicStoryListItem[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  return cachedLiveStoryListItems(active.releaseId, active.activatedAt);
}

async function loadLiveStory(slug: string): Promise<PublicStoryView | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  return fetchPublicStoryProjection(active.releaseId, slug);
}

/**
 * Thin story list for `/stories` index cards. Live path uses field-masked Firestore reads
 * + process TTL / `unstable_cache`; never pulls full `body[]` into the list cache.
 */
export const listPublicStoryListItems = cache(async function listPublicStoryListItems(): Promise<{
  readonly data: readonly PublicStoryListItem[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: listSnapshotStoryListItems(), source: 'snapshot' };
  }

  try {
    const live = await loadLiveStoryListItems();
    if (live !== undefined) {
      return { data: live, source: 'live' };
    }
  } catch {
    // fall through
  }

  return { data: listSnapshotStoryListItems(), source: 'snapshot' };
});

/**
 * Full story docs for `generateStaticParams` and callers that need bodies/related ids.
 * Not used by the `/stories` index (see `listPublicStoryListItems`).
 */
export const listPublicStoryViews = cache(async function listPublicStoryViews(): Promise<{
  readonly data: readonly PublicStoryView[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: listSnapshotStoryProjections(), source: 'snapshot' };
  }

  try {
    if (shouldUseLivePublicProjections()) {
      const active = await getCachedActiveRelease();
      if (active) {
        const stories = await listPublicStoryProjections(active.releaseId);
        if (stories.length > 0) {
          return { data: stories, source: 'live' };
        }
      }
    }
  } catch {
    // fall through
  }

  return { data: listSnapshotStoryProjections(), source: 'snapshot' };
});

/** Resolve one story by slug: live projection, then Firebase seed snapshot. */
export const resolvePublicStoryView = cache(async function resolvePublicStoryView(
  slug: string,
): Promise<PublicReadResult<PublicStoryView>> {
  if (isPublicReadApiDisabled()) {
    const snapshot = getSnapshotStoryProjection(slug);
    return snapshot ? { data: snapshot, source: 'snapshot' } : { data: undefined, source: 'none' };
  }

  try {
    const live = await loadLiveStory(slug);
    if (live) return { data: live, source: 'live' };
  } catch {
    // fall through
  }

  const snapshot = getSnapshotStoryProjection(slug);
  if (snapshot) return { data: snapshot, source: 'snapshot' };
  return { data: undefined, source: 'none' };
});
