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
import {
  mapProjectionToEntityV1,
  MAX_LIVE_SEARCH_SCAN,
} from './projection-mapping.js';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  type PostgresQueryFn,
} from './postgres-readers.js';
import { queryPostgres } from './postgres-client.js';

export function mapPublicSearchProjection(doc: PublicSearchProjectionDoc): PublicSearchIndexDoc {
  const notabilityBasis: readonly NotabilityBasisRecord[] = (doc.notabilityBasis ?? []).map((entry) => ({
    criterion: entry.criterion as NotabilityBasisRecord['criterion'],
    note: entry.note,
    evidenceIds: entry.evidenceIds,
  }));

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

/** Matches `apps/web`'s release-catalog cache window (`RELEASE_CATALOG_REVALIDATE_SECONDS`). */
const ENTITY_PROJECTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
/** Only ever 1-2 releases are active in practice; bounded defensively against release churn. */
const MAX_CACHED_RELEASES = 4;

type EntityProjectionsList = Awaited<ReturnType<typeof listPublicEntityProjections>>;

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

  async function listPublicEntityProjectionsCached(releaseId: string): Promise<EntityProjectionsList> {
    const now = Date.now();
    const hit = projectionsCache.get(releaseId);
    if (hit && hit.expiresAtMs > now) {
      return hit.value;
    }
    const value = await listPublicEntityProjections(releaseId, runQuery);
    if (!projectionsCache.has(releaseId) && projectionsCache.size >= MAX_CACHED_RELEASES) {
      projectionsCache.clear();
    }
    projectionsCache.set(releaseId, { value, expiresAtMs: now + ENTITY_PROJECTIONS_CACHE_TTL_MS });
    return value;
  }

  return {
    async readReleasePointer(): Promise<ReleasePointer | undefined> {
      const active = await fetchActiveRelease(runQuery);
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
      const indexDocs = await listPublicSearchIndexDocs(searchOptions.releaseId, runQuery);
      if (indexDocs.length > 0) {
        return searchOverIndex(
          indexDocs.map(mapPublicSearchProjection),
          canonical,
        );
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
