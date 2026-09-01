/**
 * Public data source selector: Supabase Postgres (`bb_public.*`) is the sole source of truth.
 * Hydrates 1-hop related neighbor stubs and composes capped 2-hop continue-learning on
 * entity pages only. List/map/search may use versioned release artifacts as a read-through
 * cache, but canonical live reads always come from `bb_public.*`. Postgres read failures propagate
 * as errors — there is no hardcoded seed/snapshot fallback.
 * Card rails use a thin batched point-get (`listPublicEntityViewsByIds`) — never the
 * 2-hop learning graph. Sitemap and entity `generateStaticParams` use `getPublicSearchIndex`
 * (ids only), not the full hydrated entity catalog. Oversized live catalogs (>~1.8MB) stay in
 * process memory only; Next's 2MB data-cache limit must not receive the fat array.
 *
 * Cost knobs (env / Vercel):
 * - `APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL` — CDN/GCS base for entities.json / search-index.json
 * - Vercel Fluid Compute / function concurrency — primary idle/active cost driver
 */

import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import type { PublicEntityProjectionDoc } from '@repo/schemas';
import {
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  type NeighborLookup,
} from '@repo/domain/learning-index';
import type { PublicEntityView, RelatedNeighborView } from '../../data/public-seed';
import { buildGraphTimeline, isUndatedTimelineEntry } from '../../data/entity-graph-seed';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  fetchPublicEntityProjectionsByIds,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  parseEntityProjection,
  parseSearchIndexDoc,
  shouldUseLivePublicProjections,
} from './public-readers';
import { isPostgresPublicDataMisconfigured, shouldPreferReleaseArtifacts } from './live-policy';
import {
  createLiveCatalogMemoryCache,
  createSingleFlight,
  isOversizedLiveCatalogSentinel,
  liveCatalogCacheKey,
  nextDataCacheValueForCatalog,
  type LiveCatalogKind,
  type LiveCatalogMemoryCache,
} from './live-catalog-cache';
import { mapProjectionToPublicEntityView, type PublicProjectionInput } from './map-projection';
import { mapPublicSearchProjection } from './map-search-index';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids';
import { searchIndexReadyForRecords } from '../records/build-records-index';
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
} from './release-artifacts';

/**
 * Cross-request cache window for release catalog / search index (seconds).
 *
 * Correction (repo-csw0 follow-up): the cache key includes `releaseId + activatedAt`, but
 * those do NOT change when content is corrected in place — dozens of `packages/ops-data/scripts`
 * fix/backfill scripts upsert `bb_public.release_entities` under the *same* release id and
 * `active_release.activated_at` is not bumped by them. So this TTL is a real freshness bound
 * on editorial corrections, not just a memory bound as originally assumed when it was raised
 * from 300s to 6h. 30 minutes bounds a correction's visible staleness to roughly
 * TTL + the artifact-republish cron interval (`publish-release-catalog-artifacts.yml`) while
 * keeping Postgres pulls far below the pre-fix rate (~48 calls/day/instance vs one per request).
 */
const RELEASE_CATALOG_REVALIDATE_SECONDS = 1_800; // 30m
const RELEASE_CATALOG_TTL_MS = RELEASE_CATALOG_REVALIDATE_SECONDS * 1000;

/**
 * How long a fetched active-release pointer may serve across requests. The pointer
 * was previously read from Postgres on every request (~625k reads per billing
 * period); a short window keeps release activation near-immediate while collapsing
 * that to ~2 reads/min/instance.
 */
const ACTIVE_RELEASE_POINTER_TTL_MS = 30_000;

type ActiveReleaseResult = Awaited<ReturnType<typeof fetchActiveRelease>>;
let activeReleaseMemo: { value: ActiveReleaseResult; expiresAtMs: number } | undefined;

async function fetchActiveReleaseMemoized(): Promise<ActiveReleaseResult> {
  const now = Date.now();
  if (activeReleaseMemo && activeReleaseMemo.expiresAtMs > now) {
    return activeReleaseMemo.value;
  }
  const value = await fetchActiveRelease();
  // Only memoize successful reads; a missing pointer should retry next request.
  if (value !== undefined) {
    activeReleaseMemo = { value, expiresAtMs: now + ACTIVE_RELEASE_POINTER_TTL_MS };
  }
  return value;
}

/** Process-local store for public release catalogs (never private/research docs). */
const liveEntitiesMemory = createLiveCatalogMemoryCache<readonly PublicEntityView[]>({
  defaultTtlMs: RELEASE_CATALOG_TTL_MS,
});
const liveSearchIndexMemory = createLiveCatalogMemoryCache<readonly PublicSearchIndexDoc[]>({
  defaultTtlMs: RELEASE_CATALOG_TTL_MS,
});
/** One active-release pointer read per request (shared across entities/search). */
const getCachedActiveRelease = cache(fetchActiveReleaseMemoized);

/**
 * Thin active-release meta for sitemap / cache keys — one pointer read, no catalog load.
 */
export const getPublicActiveReleaseMeta = cache(
  async function getPublicActiveReleaseMeta(): Promise<
    | {
        readonly releaseId: string;
        readonly activatedAt: string;
      }
    | undefined
  > {
    if (!shouldUseLivePublicProjections()) return undefined;
    try {
      const active = await getCachedActiveRelease();
      if (!active) return undefined;
      return { releaseId: active.releaseId, activatedAt: active.activatedAt };
    } catch {
      return undefined;
    }
  },
);

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
 * Prebuilt per-catalog lookups. Building these is O(catalog); doing it inside
 * `hydrateEntityLearningLinks` made whole-catalog hydration O(catalog²) — for the ~4.1k national
 * release that was ~33M Map insertions and 8k Map allocations per cold start, burned on every
 * instance on both the artifact and Postgres paths. Built once by `mapProjectionsToHydratedViews`
 * and shared across every entity in the pass.
 */
type CatalogLookups = {
  readonly neighborsById: Map<string, NeighborLookup>;
  readonly displayNameById: Map<string, { readonly displayName: string }>;
};

function buildCatalogLookups(catalog: readonly PublicEntityView[]): CatalogLookups {
  const neighborsById = new Map<string, NeighborLookup>();
  const displayNameById = new Map<string, { readonly displayName: string }>();
  for (const item of catalog) {
    neighborsById.set(item.id, toNeighborLookup(item));
    displayNameById.set(item.id, { displayName: item.displayName });
  }
  return { neighborsById, displayNameById };
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
  };
}

function mapProjectionsToHydratedViews(
  projections: readonly PublicEntityProjectionDoc[],
): readonly PublicEntityView[] {
  const mapped = projections.map((projection) =>
    mapProjectionToPublicEntityView(projection as PublicProjectionInput),
  );
  const lookups = buildCatalogLookups(mapped);
  return mapped.map((entity) => hydrateEntityLearningLinks(entity, mapped, lookups));
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
    if (parsed) out.push(mapPublicSearchProjection(parsed));
  }
  return out;
}

/**
 * A configured, version-matched `entities.json` is an optional release cache. Without an
 * explicit artifact origin, this falls through to canonical Postgres reads.
 */
async function loadLiveEntitiesForRelease(
  releaseId: string,
): Promise<readonly PublicEntityView[] | undefined> {
  if (shouldPreferReleaseArtifacts()) {
    const artifact = await fetchReleaseEntitiesListArtifact(releaseId);
    if (artifact && artifact.entities.length > 0) {
      const projections = projectionsFromArtifactEntities(artifact.entities);
      if (projections.length > 0) return mapProjectionsToHydratedViews(projections);
      console.warn(
        `[public-data] entities artifact had ${artifact.entities.length} entries but none parsed; falling back to Postgres`,
      );
    }
    // Every arrival here is a full multi-MB catalog pull. release-artifacts.ts has already
    // logged the specific reason; this line marks the cost that reason caused.
    console.warn(
      `[public-data] full Postgres entity catalog pull for ${releaseId} (artifact unusable)`,
    );
  }

  const projections = await listPublicEntityProjections(releaseId);
  if (projections.length === 0) return undefined;
  return mapProjectionsToHydratedViews(projections);
}

async function loadLiveSearchIndexForRelease(
  releaseId: string,
): Promise<readonly PublicSearchIndexDoc[] | undefined> {
  let artifactMapped: readonly PublicSearchIndexDoc[] | undefined;
  if (shouldPreferReleaseArtifacts()) {
    const artifact = await fetchReleaseSearchIndexArtifact(releaseId);
    if (artifact && artifact.docs.length > 0) {
      const mapped = searchDocsFromArtifact(artifact.docs);
      // Prefer an artifact that already carries confidenceTier (Records slim). After a
      // facets-only SQL backfill the CDN blob can lag; falling through to Postgres avoids a
      // full release_entities hydrate while still serving search from the slim index.
      if (mapped.length > 0 && searchIndexReadyForRecords(mapped)) {
        return mapped;
      }
      if (mapped.length > 0) {
        artifactMapped = mapped;
        console.warn(
          `[public-data] search-index artifact missing confidenceTier coverage; preferring Postgres for ${releaseId}`,
        );
      }
    } else {
      console.warn(
        `[public-data] full Postgres search-index pull for ${releaseId} (artifact unusable)`,
      );
    }
  }

  const projectionDocs = await listPublicSearchIndexDocs(releaseId);
  if (projectionDocs.length > 0) {
    return projectionDocs.map(mapPublicSearchProjection);
  }
  return artifactMapped;
}

/**
 * Load a live catalog with process-local TTL for fat payloads and size-gated Next data cache.
 * When the serialized catalog exceeds the safe ceiling, Next stores only a tiny oversized
 * sentinel (never the full array) so SET no longer warns and every instance still fills memory.
 */
/**
 * In-flight catalog loads, keyed like the memory cache.
 *
 * Without this, the process-memory TTL and the Next data-cache `revalidate` window are both
 * 30 minutes and therefore expire together: at that instant every concurrent request on the
 * instance misses memory, and the oversized-sentinel branch below calls `load()` *outside*
 * `unstable_cache`, which does no deduplication of its own. N concurrent requests meant N
 * concurrent full catalog loads — the bursty Postgres read pattern observed on 2026-08-08
 * (several full pulls within seconds, then quiet). One load per key now serves all waiters.
 *
 * Entities and search index share one map; the key already carries the catalog kind.
 */
const singleFlight = createSingleFlight();

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

  return singleFlight(memKey, () => loadAndCacheLiveCatalog(memKey, options));
}

async function loadAndCacheLiveCatalog<T>(
  memKey: string,
  options: {
    readonly kind: LiveCatalogKind;
    readonly releaseId: string;
    readonly activatedAt: string;
    readonly memory: LiveCatalogMemoryCache<T>;
    readonly load: () => Promise<T | undefined>;
    readonly nextCacheKeyPrefix: string;
  },
): Promise<T | undefined> {
  // Re-check: a load that completed while this caller queued behind the single-flight key
  // has already populated memory.
  const raced = options.memory.get(memKey);
  if (raced !== undefined) {
    return raced;
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
    kind: 'search-index-v2',
    releaseId,
    activatedAt,
    memory: liveSearchIndexMemory,
    load: () => loadLiveSearchIndexForRelease(releaseId),
    nextCacheKeyPrefix: 'public-release-search-index-v2',
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
    const oneHopProjections =
      oneHopIds.length > 0
        ? await fetchPublicEntityProjectionsByIds(active.releaseId, oneHopIds)
        : [];
    const oneHopViews = oneHopProjections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    const twoHopIds = collectTwoHopNeighborIds(entityId, oneHopIds, oneHopViews);
    const twoHopProjections =
      twoHopIds.length > 0
        ? await fetchPublicEntityProjectionsByIds(active.releaseId, twoHopIds)
        : [];
    const twoHopViews = twoHopProjections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    const catalog = [entity, ...oneHopViews, ...twoHopViews];
    return hydrateEntityLearningLinks(entity, catalog);
  } catch (error) {
    // Never mix Dunbar seed neighbors into a live entity — hydrate with the entity alone.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[public-data] neighbor batch failed for ${entityId}; hydrating without seed catalog: ${message}`,
    );
    return hydrateEntityLearningLinks(entity, [entity]);
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

/** Source of a public read result. `'none'` means a genuine miss (not-found), never a degraded fallback. */
export type PublicReadSource = 'live' | 'none';

export interface PublicReadResult<T> {
  readonly data: T | undefined;
  readonly source: PublicReadSource;
}

/**
 * Resolve one entity: live Postgres projection only. Postgres failures propagate as errors;
 * a genuine miss returns not-found. No seed/snapshot fallback.
 */
export const resolvePublicEntityView = cache(async function resolvePublicEntityView(
  entityId: string,
): Promise<PublicReadResult<PublicEntityView>> {
  const live = await loadLiveEntity(entityId);
  return live !== undefined ? { data: live, source: 'live' } : { data: undefined, source: 'none' };
});

/**
 * List entities from live release artifacts/cache. Postgres is the sole source of truth;
 * misconfiguration or read failure surfaces as a thrown error, never a seed fallback.
 */
export const listPublicEntityViews = cache(async function listPublicEntityViews(): Promise<{
  readonly data: readonly PublicEntityView[];
  readonly source: PublicReadSource;
}> {
  if (isPostgresPublicDataMisconfigured()) {
    throw new Error(
      '[public-data] PUBLIC_DATA_SOURCE=postgres requires DATABASE_URL (or APP_DATABASE_URL).',
    );
  }

  const live = await loadLiveEntities();
  if (live === undefined) {
    throw new Error('[public-data] postgres live catalog unavailable');
  }
  return { data: live, source: 'live' };
});

/**
 * Search index: prefer a version-matched release artifact, then Postgres `bb_public.search_index`.
 * Never rebuilds from a full entity projection scan when live index exists. No seed fallback.
 */
export const getPublicSearchIndex = cache(async function getPublicSearchIndex(): Promise<{
  readonly data: readonly PublicSearchIndexDoc[];
  readonly source: PublicReadSource;
}> {
  if (!shouldUseLivePublicProjections()) {
    throw new Error('[public-data] live public projections are not enabled');
  }
  const active = await getCachedActiveRelease();
  if (!active) {
    throw new Error('[public-data] no active release for search index');
  }
  const live = await cachedLiveSearchIndex(active.releaseId, active.activatedAt);
  if (live === undefined || live.length === 0) {
    throw new Error('[public-data] postgres search index unavailable');
  }
  return { data: live, source: 'live' };
});

/**
 * Batched entity cards for non-entity pages (story related rails). Dedupes + sorts ids for a
 * stable `React.cache` key (arrays are reference-unstable), then reorders to request order.
 * Never runs learning-graph hydration. No seed fallback.
 */
const listPublicEntityViewsByIdsCached = cache(async function listPublicEntityViewsByIdsCached(
  stableIdsKey: string,
): Promise<{
  readonly byId: ReadonlyMap<string, PublicEntityView>;
  readonly source: PublicReadSource;
}> {
  const unique =
    stableIdsKey.length === 0 ? ([] as string[]) : stableIdsKey.split('\u0001').filter(Boolean);

  if (unique.length === 0) {
    return { byId: new Map(), source: 'none' };
  }

  const live = await loadLiveEntitiesByIdsThin(unique);
  const byId = new Map((live ?? []).map((entity) => [entity.id, entity] as const));
  return { byId, source: 'live' };
});

export async function listPublicEntityViewsByIds(entityIds: readonly string[]): Promise<{
  readonly data: readonly PublicEntityView[];
  readonly source: PublicReadSource;
}> {
  const requestOrder = [...new Set(entityIds.map((id) => id.trim()).filter((id) => id.length > 0))];
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
