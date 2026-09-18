/**
 * Live Postgres `published` bindings for `PublicDataAccess` (the Postgres source-of-record cutover,
 * `docs/decisions-carryover.md`, "entity source-of-truth precedence").
 *
 * Reads the same Supabase Postgres projections as `apps/web/src/lib/public-data/postgres-readers.ts`
 * and maps them onto `@repo/public-contracts` DTOs via the shared projection mapper in
 * `./projection-mapping.ts` (storage-neutral mapping — Postgres is the only live read path).
 */
import type { NotabilityBasisRecord, PublicSearchIndexDoc } from '@repo/domain';
import {
  buildCitesEdge,
  storiesCiting,
  type CitesEdgeIndex,
} from '@repo/domain/publication/cites-edge';
import type { PublicSearchProjectionDoc } from '@repo/schemas';
import type { CanonicalSearchQuery } from '@repo/security';
import { entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import type { PublicDataAccessReaders, ReleasePointer, SearchPage } from './data-access.js';
import { searchOverEntities, searchOverIndex } from './data-access.js';
import { mapProjectionToEntityV1, MAX_LIVE_SEARCH_SCAN } from './projection-mapping.js';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  fetchPublicEntityRedirect,
  listPublicEntityProjections,
  listPublicReleaseArticles,
  listPublicSearchIndexDocs,
  type PostgresQueryFn,
} from './postgres-readers.js';
import { hydrateEntityV1Neighbors } from './hydrate-entity-neighbors.js';
import { queryPostgres } from './postgres-client.js';
import {
  loadEntityProjectionsFromArtifact,
  loadSearchIndexDocsFromArtifact,
} from './release-artifact-catalogs.js';
import { createSingleFlight } from './single-flight.js';

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
    ...(doc.evidenceInputs !== undefined ? { evidenceInputs: doc.evidenceInputs } : {}),
    ...(doc.geohash !== undefined ? { geohash: doc.geohash } : {}),
  };
}

export type CreatePostgresDataAccessReadersOptions = {
  readonly query?: PostgresQueryFn;
};

/**
 * Matches the web release-catalog cache window. Operators can correct rows under the same
 * release id, so this TTL bounds cache freshness after artifact publication. Artifact
 * regeneration is explicit; no scheduled republish is assumed.
 */
const ENTITY_PROJECTIONS_CACHE_TTL_MS = 30 * 60 * 1000;
/** Only ever 1-2 releases are active in practice; bounded defensively against release churn. */
const MAX_CACHED_RELEASES = 4;
/** Active-release pointer reads were per-request; a short window keeps activation prompt. */
const ACTIVE_RELEASE_POINTER_TTL_MS = 30_000;

/** True when enough search docs carry evidenceInputs (post-backfill / republished artifact). */
function searchIndexHasConfidenceCoverage(
  docs: readonly PublicSearchProjectionDoc[],
  minCoverage = 0.95,
): boolean {
  if (docs.length === 0) return false;
  let withInputs = 0;
  for (const doc of docs) {
    if (doc.evidenceInputs !== undefined) withInputs += 1;
  }
  return withInputs / docs.length >= minCoverage;
}

/**
 * Cap on stories advertised per record, matching the wire contract's own bound. A record the
 * archive has written about many times still links to a readable list, not a wall.
 */
const MAX_CITING_STORIES_PER_RECORD = 25;

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
  // the life of this warm instance — same TTL convention `apps/web` already
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
  /*
   * The story-cites-record edge is a fold over EVERY article in the release. Recomputing it per
   * request would make each record open cost a full article scan, which is exactly the shape of
   * read this cache exists to stop — so it is memoized on the same release key, TTL and
   * single-flight as the entity catalog above. `apps/web` reaches the same conclusion with
   * `cache()` over its release-scoped article cache.
   */
  const citesEdgeCache = new Map<
    string,
    { readonly value: CitesEdgeIndex; readonly expiresAtMs: number }
  >();
  let activeReleaseMemo:
    { readonly value: ActiveReleaseResult; readonly expiresAtMs: number } | undefined;
  const singleFlight = createSingleFlight();

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
    return singleFlight(`entities:${releaseId}`, async () => {
      const raced = readReleaseCache(projectionsCache, releaseId);
      if (raced) return raced;
      // CDN artifact first so a cold start does not pull the whole catalog out of Postgres;
      // `undefined` (unconfigured origin, miss, or release mismatch) falls through to the SoR.
      const value =
        (await loadEntityProjectionsFromArtifact(releaseId)) ??
        (await listPublicEntityProjections(releaseId, runQuery));
      writeReleaseCache(projectionsCache, releaseId, value);
      return value;
    });
  }

  async function listPublicSearchIndexDocsCached(releaseId: string): Promise<SearchIndexList> {
    const hit = readReleaseCache(searchIndexCache, releaseId);
    if (hit) return hit;
    return singleFlight(`search-index:${releaseId}`, async () => {
      const raced = readReleaseCache(searchIndexCache, releaseId);
      if (raced) return raced;

      const fromArtifact = await loadSearchIndexDocsFromArtifact(releaseId);
      if (fromArtifact && searchIndexHasConfidenceCoverage(fromArtifact)) {
        writeReleaseCache(searchIndexCache, releaseId, fromArtifact);
        return fromArtifact;
      }
      if (fromArtifact && fromArtifact.length > 0) {
        console.warn(
          `[api-public] search-index artifact missing evidenceInputs coverage; preferring Postgres for ${releaseId}`,
        );
      }

      const fromSql = await listPublicSearchIndexDocs(releaseId, runQuery);
      const value = fromSql.length > 0 ? fromSql : (fromArtifact ?? []);
      writeReleaseCache(searchIndexCache, releaseId, value);
      return value;
    });
  }

  /**
   * The cites edge for a release. Degrades to an empty index rather than throwing: a record
   * missing its story links is worse than ideal, a record that 500s because the article table is
   * unreachable is unacceptable — the same posture web's `resolveCitesEdgeIndex` takes.
   */
  async function citesEdgeCached(releaseId: string): Promise<CitesEdgeIndex> {
    const hit = readReleaseCache(citesEdgeCache, releaseId);
    if (hit) return hit;
    return singleFlight(`cites-edge:${releaseId}`, async () => {
      const raced = readReleaseCache(citesEdgeCache, releaseId);
      if (raced) return raced;
      let value: CitesEdgeIndex = {};
      try {
        value = buildCitesEdge(await listPublicReleaseArticles(releaseId, runQuery));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[api-public] article read failed for ${releaseId}; serving records without story links: ${message}`,
        );
        return value;
      }
      writeReleaseCache(citesEdgeCache, releaseId, value);
      return value;
    });
  }

  /** Attaches the stories citing this record. Absent, never empty — see `entityV1Schema`. */
  function withCitingStories(entity: EntityV1, citesEdge: CitesEdgeIndex): EntityV1 {
    const citing = storiesCiting(citesEdge, entity.id);
    if (citing.length === 0) return entity;
    return { ...entity, citingStories: citing.slice(0, MAX_CITING_STORIES_PER_RECORD) };
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
      const mapped = mapProjectionToEntityV1(projection);
      if (!mapped) return undefined;
      const hydrated = await hydrateEntityV1Neighbors(mapped, releaseId, runQuery);
      return withCitingStories(hydrated, await citesEdgeCached(releaseId));
    },

    async readEntityRedirect(releaseId, entityId): Promise<string | undefined> {
      // Read merge redirects without caching: the primary-key lookup occurs only on an entity
      // miss, and a reversed merge must not retain a stale forwarding address.
      return fetchPublicEntityRedirect(releaseId, entityId, runQuery);
    },

    async readEntities(releaseId): Promise<readonly EntityV1[]> {
      const projections = await listPublicEntityProjectionsCached(releaseId);
      const citesEdge = await citesEdgeCached(releaseId);
      const entities: EntityV1[] = [];
      for (const projection of projections) {
        const mapped = mapProjectionToEntityV1(projection);
        if (mapped) entities.push(entityV1Schema.parse(withCitingStories(mapped, citesEdge)));
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
