/**
 * Live Postgres `bb_public` bindings for `PublicDataAccess` (MOB-004 / ADR-020 SoR cutover).
 *
 * Reads the same Supabase Postgres projections as `apps/web/src/lib/public-data/postgres-readers.ts`
 * and maps them onto `@repo/public-contracts` DTOs via the shared projection mapper in
 * `./projection-mapping.ts` (storage-neutral mapping — Postgres is the only live read path).
 */
import type { NotabilityBasisRecord, PublicSearchIndexDoc } from '@repo/domain';
import type { PublicSearchProjectionDoc } from '@repo/schemas';
import type { CanonicalSearchQuery } from '@repo/security';
import { entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import type { PublicDataAccessReaders, ReleasePointer, SearchPage } from './data-access.js';
import { searchOverEntities, searchOverIndex } from './data-access.js';
import { mapProjectionToEntityV1, MAX_LIVE_SEARCH_SCAN } from './projection-mapping.js';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  type PostgresQueryFn,
} from './postgres-readers.js';
import { queryPostgres } from './postgres-client.js';
import {
  loadEntityProjectionsFromArtifact,
  loadSearchIndexDocsFromArtifact,
} from './release-artifact-catalogs.js';

export function mapPublicSearchProjection(doc: PublicSearchProjectionDoc): PublicSearchIndexDoc {
  const notabilityBasis: readonly NotabilityBasisRecord[] = (doc.notabilityBasis ?? []).map(
    (entry) => ({
      criterion: entry.criterion as NotabilityBasisRecord['criterion'],
      note: entry.note,
      evidenceIds: entry.evidenceIds,
    }),
  );

  return {
    id: doc.id,
    releaseId: doc.releaseId,
    kind: doc.kind,
    displayName: doc.displayName,
    nameLower: doc.nameLower,
    aliases: doc.aliases,
    ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
    topicTags: doc.topicTags,
    ...(doc.topicIds.length > 0 ? { topicIds: doc.topicIds } : {}),
    ...(doc.jurisdictionState !== undefined ? { jurisdictionState: doc.jurisdictionState } : {}),
    ...(doc.status !== undefined ? { status: doc.status } : {}),
    eraBuckets: doc.eraBuckets,
    notabilityBasis,
    notabilityLabels: doc.notabilityLabels,
    ...(doc.sensitivityClass !== undefined ? { sensitivityClass: doc.sensitivityClass } : {}),
    recordMaturity: doc.recordMaturity,
    researchCoverage: doc.researchCoverage,
    relatedCount: doc.relatedCount,
    claimCount: doc.claimCount,
  };
}

export type CreatePostgresDataAccessReadersOptions = {
  readonly query?: PostgresQueryFn;
};

/**
 * Matches `apps/web`'s release-catalog cache window (`RELEASE_CATALOG_REVALIDATE_SECONDS`).
 *
 * Correction (repo-csw0 follow-up): release contents are NOT immutable once published —
 * `packages/ops-data/scripts` fix/backfill scripts upsert `bb_public.release_entities` in
 * place under the same release id, without bumping `active_release.activated_at`. So this
 * TTL is a real freshness bound on editorial corrections, not just a memory bound. 30 minutes
 * bounds visible staleness to roughly TTL + the artifact-republish cron interval
 * (`publish-release-catalog-artifacts.yml`) while keeping Postgres pulls far below the
 * pre-fix per-request rate.
 */
const ENTITY_PROJECTIONS_CACHE_TTL_MS = 30 * 60 * 1000;
/** Only ever 1-2 releases are active in practice; bounded defensively against release churn. */
const MAX_CACHED_RELEASES = 4;
/** Active-release pointer reads were per-request; a short window keeps activation prompt. */
const ACTIVE_RELEASE_POINTER_TTL_MS = 30_000;

type EntityProjectionsList = Awaited<ReturnType<typeof listPublicEntityProjections>>;
type SearchIndexList = Awaited<ReturnType<typeof listPublicSearchIndexDocs>>;
type ActiveReleaseResult = Awaited<ReturnType<typeof fetchActiveRelease>>;

function mapActiveReleaseToPointer(
  active: NonNullable<Awaited<ReturnType<typeof fetchActiveRelease>>>,
): ReleasePointer {
  return {
    activeRelease: {
      releaseId: active.releaseId,
      generatedAt: active.activatedAt,
      recordUpdatedAt: active.activatedAt,
    },
    searchIndexVersion: active.searchIndexVersion,
  };
}

export function createPostgresDataAccessReaders(
  options: CreatePostgresDataAccessReadersOptions = {},
): PublicDataAccessReaders {
  const runQuery: PostgresQueryFn = options.query ?? queryPostgres;

  // `readEntities` and `readSearchPage`'s fallback both pull every entity in the active
  // release — by far the most expensive query against Postgres (DB advisor: ~80% of all
  // query time in the project) because it re-runs on every request even though the underlying
  // data only changes when a release publishes. Cache it in-process, keyed by release id, for
  // the life of this long-running Cloud Run instance — same TTL convention `apps/web` already
  // uses for its release-catalog cache.
  const projectionsCache = new Map<
    string,
    { readonly value: EntityProjectionsList; readonly expiresAtMs: number }
  >();
  // `readSearchPage` previously re-pulled the entire search index from Postgres on every
  // search request (~3MB each) — cache it under the same release-keyed convention.
  const searchIndexCache = new Map<
    string,
    { readonly value: SearchIndexList; readonly expiresAtMs: number }
  >();
  let activeReleaseMemo:
    { readonly value: ActiveReleaseResult; readonly expiresAtMs: number } | undefined;

  function readReleaseCache<Value>(
    cache: Map<string, { readonly value: Value; readonly expiresAtMs: number }>,
    releaseId: string,
  ): Value | undefined {
    const hit = cache.get(releaseId);
    return hit && hit.expiresAtMs > Date.now() ? hit.value : undefined;
  }

  function writeReleaseCache<Value>(
    cache: Map<string, { readonly value: Value; readonly expiresAtMs: number }>,
    releaseId: string,
    value: Value,
  ): void {
    if (!cache.has(releaseId) && cache.size >= MAX_CACHED_RELEASES) {
      cache.clear();
    }
    cache.set(releaseId, { value, expiresAtMs: Date.now() + ENTITY_PROJECTIONS_CACHE_TTL_MS });
  }

  async function listPublicEntityProjectionsCached(
    releaseId: string,
  ): Promise<EntityProjectionsList> {
    const hit = readReleaseCache(projectionsCache, releaseId);
    if (hit) return hit;
    // CDN artifact first so a cold start does not pull the whole catalog out of Postgres;
    // `undefined` (unconfigured origin, miss, or release mismatch) falls through to the SoR.
    const value =
      (await loadEntityProjectionsFromArtifact(releaseId)) ??
      (await listPublicEntityProjections(releaseId, runQuery));
    writeReleaseCache(projectionsCache, releaseId, value);
    return value;
  }

  async function listPublicSearchIndexDocsCached(releaseId: string): Promise<SearchIndexList> {
    const hit = readReleaseCache(searchIndexCache, releaseId);
    if (hit) return hit;
    const value =
      (await loadSearchIndexDocsFromArtifact(releaseId)) ??
      (await listPublicSearchIndexDocs(releaseId, runQuery));
    writeReleaseCache(searchIndexCache, releaseId, value);
    return value;
  }

  async function fetchActiveReleaseMemoized(): Promise<ActiveReleaseResult> {
    if (activeReleaseMemo && activeReleaseMemo.expiresAtMs > Date.now()) {
      return activeReleaseMemo.value;
    }
    const value = await fetchActiveRelease(runQuery);
    // Only memoize successful reads; a missing pointer should retry next request.
    if (value !== undefined) {
      activeReleaseMemo = { value, expiresAtMs: Date.now() + ACTIVE_RELEASE_POINTER_TTL_MS };
    }
    return value;
  }

  return {
    async readReleasePointer(): Promise<ReleasePointer | undefined> {
      const active = await fetchActiveReleaseMemoized();
      if (!active) return undefined;
      return mapActiveReleaseToPointer(active);
    },

    async readEntity(releaseId, entityId): Promise<EntityV1 | undefined> {
      const projection = await fetchPublicEntityProjection(releaseId, entityId, runQuery);
      if (!projection) return undefined;
      return mapProjectionToEntityV1(projection);
    },

    async readEntities(releaseId): Promise<readonly EntityV1[]> {
      const projections = await listPublicEntityProjectionsCached(releaseId);
      const entities: EntityV1[] = [];
      for (const projection of projections) {
        const mapped = mapProjectionToEntityV1(projection);
        if (mapped) entities.push(entityV1Schema.parse(mapped));
      }
      return entities;
    },

    async readSearchPage(
      canonical: CanonicalSearchQuery,
      searchOptions: { readonly releaseId: string },
    ): Promise<SearchPage> {
      const indexDocs = await listPublicSearchIndexDocsCached(searchOptions.releaseId);
      if (indexDocs.length > 0) {
        return searchOverIndex(indexDocs.map(mapPublicSearchProjection), canonical);
      }

      const projections = await listPublicEntityProjectionsCached(searchOptions.releaseId);
      const entities: EntityV1[] = [];
      for (const projection of projections.slice(0, MAX_LIVE_SEARCH_SCAN)) {
        const mapped = mapProjectionToEntityV1(projection);
        if (mapped) entities.push(entityV1Schema.parse(mapped));
      }
      return searchOverEntities(entities, canonical);
    },
  };
}
