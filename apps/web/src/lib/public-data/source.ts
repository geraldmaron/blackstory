/**
 * Public data source selector: Supabase Postgres (`published.*`) is the sole source of truth.
 * Hydrates 1-hop related neighbor stubs and composes capped 2-hop continue-learning on
 * entity pages only. List/map/search may use versioned release artifacts as a read-through
 * cache, but canonical live reads always come from `published.*`. Postgres read failures propagate
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

import { cache } from 'react';
import type { PublicSearchIndexDoc } from '@repo/domain/search';
import type { PublicEntityView } from '../../data/public-seed';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  fetchPublicEntityProjectionsByIds,
  fetchPublicEntityRedirect,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  parseSearchIndexDoc,
  shouldUseLivePublicProjections,
} from './public-readers';
import { isPostgresPublicDataMisconfigured, shouldPreferReleaseArtifacts } from './live-policy';
import { createReleaseScopedCache } from './release-scoped-cache';
import {
  hydrateEntityLearningLinks,
  loadEntityNeighborhood,
  mapProjectionsToHydratedViews,
  projectionsFromArtifactEntities,
  retainCitedRelationshipViews,
  thinViewsFromProjections,
} from './entity-views';

// These two were exported from this module before the extraction; callers keep importing them here.
export { hydrateEntityLearningLinks, retainCitedRelationshipViews };
import { mapPublicSearchProjection } from './map-search-index';
import { searchIndexReadyForRecords } from '../records/build-records-index';
import { fetchReleaseEntitiesListArtifact, fetchReleaseSearchIndexArtifact } from '@repo/domain';

/**
 * Cross-request cache window for release catalog / search index (seconds).
 *
 * The cache key includes `releaseId + activatedAt`, which remain stable when a published record
 * is corrected in place. This TTL therefore bounds correction staleness in one process while
 * avoiding a catalog read per request.
 */
const RELEASE_CATALOG_REVALIDATE_SECONDS = 1_800; // 30m

/**
 * Share the active-release pointer briefly across requests without materially delaying a newly
 * activated release.
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

/**
 * Cross-request stores for the public release catalogs (never private/research docs). Memory,
 * single-flight, then Next's data cache, keyed on the active release — see
 * release-scoped-cache.ts. Both catalogs exceed Next's 2MB entry limit (13.8 MB and 8.3 MB on
 * 2026-09-22), so each lives in process memory only and every instance loads its own copy; the
 * shared fetcher in `@repo/domain` makes that reload a conditional GET.
 */
const liveEntitiesCache = createReleaseScopedCache<readonly PublicEntityView[]>({
  kind: 'public-release-entities',
  revalidateSeconds: RELEASE_CATALOG_REVALIDATE_SECONDS,
});
const liveSearchIndexCache = createReleaseScopedCache<readonly PublicSearchIndexDoc[]>({
  kind: 'public-release-search-index-v2',
  revalidateSeconds: RELEASE_CATALOG_REVALIDATE_SECONDS,
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
    // This fallback reads the full catalog. The shared artifact fetcher has already logged why
    // the configured artifact could not be used.
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
      // Prefer an artifact that already carries evidenceInputs (Records slim). After a
      // facets-only SQL backfill the CDN blob can lag; falling through to Postgres avoids a
      // full release_entities hydrate while still serving search from the slim index.
      if (mapped.length > 0 && searchIndexReadyForRecords(mapped)) {
        return mapped;
      }
      if (mapped.length > 0) {
        artifactMapped = mapped;
        console.warn(
          `[public-data] search-index artifact missing evidenceInputs coverage; preferring Postgres for ${releaseId}`,
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

function cachedLiveEntities(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicEntityView[] | undefined> {
  return liveEntitiesCache.get({ releaseId, activatedAt }, () =>
    loadLiveEntitiesForRelease(releaseId),
  );
}

function cachedLiveSearchIndex(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicSearchIndexDoc[] | undefined> {
  return liveSearchIndexCache.get({ releaseId, activatedAt }, () =>
    loadLiveSearchIndexForRelease(releaseId),
  );
}

async function loadLiveEntities(): Promise<readonly PublicEntityView[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  return cachedLiveEntities(active.releaseId, active.activatedAt);
}

/**
 * Live single-entity path: point-read the entity and bounded relationship candidates without
 * loading the full release catalog. Entity pages use this path; story/list cards use
 * `listPublicEntityViewsByIds` instead.
 */
async function loadLiveEntity(entityId: string): Promise<PublicEntityView | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await getCachedActiveRelease();
  if (!active) return undefined;
  return loadEntityNeighborhood(active.releaseId, entityId, {
    fetchProjection: fetchPublicEntityProjection,
    fetchProjectionsByIds: fetchPublicEntityProjectionsByIds,
    warn: (message) => console.warn(message),
  });
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
  return thinViewsFromProjections(projections);
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
 * The survivor a merged-away entity id forwards to.
 *
 * Only ever called on a miss, so the common path pays nothing. A read failure resolves to
 * `undefined` rather than throwing: the caller is already about to render a 404, and a redirect
 * lookup that cannot answer must degrade to that 404 instead of turning a missing record into a
 * 500.
 */
export const resolvePublicEntityRedirect = cache(async function resolvePublicEntityRedirect(
  entityId: string,
): Promise<string | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  try {
    const active = await getCachedActiveRelease();
    if (!active) return undefined;
    return await fetchPublicEntityRedirect(active.releaseId, entityId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[public-data] redirect lookup failed for ${entityId}: ${message}`);
    return undefined;
  }
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
 * Search index: prefer a version-matched release artifact, then Postgres `published.search_index`.
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
