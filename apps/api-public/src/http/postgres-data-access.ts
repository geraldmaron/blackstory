/**
 * Live Postgres `bb_public` bindings for `PublicDataAccess` (MOB-004 / ADR-020 SoR cutover).
 *
 * Reads the same Supabase Postgres projections as `apps/web/src/lib/public-data/postgres-readers.ts`
 * and maps them onto `@repo/public-contracts` DTOs via the shared projection mapper in
 * `./firestore-data-access.ts` (storage-neutral mapping — no Firestore dependency at runtime).
 */
import type { NotabilityBasisRecord, PublicSearchIndexDoc } from '@repo/domain';
import type { PublicSearchProjectionDoc } from '@repo/schemas';
import type { CanonicalSearchQuery } from '@repo/security';
import { entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import type { FirestoreDataAccessReaders, ReleasePointer, SearchPage } from './data-access.js';
import { searchOverEntities, searchOverIndex } from './data-access.js';
import {
  mapProjectionToEntityV1,
  MAX_LIVE_SEARCH_SCAN,
} from './firestore-data-access.js';
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
): FirestoreDataAccessReaders {
  const runQuery: PostgresQueryFn = options.query ?? queryPostgres;
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

      const projections = await listPublicEntityProjections(searchOptions.releaseId, runQuery);
      const entities: EntityV1[] = [];
      for (const projection of projections.slice(0, MAX_LIVE_SEARCH_SCAN)) {
        const mapped = mapProjectionToEntityV1(projection);
        if (mapped) entities.push(entityV1Schema.parse(mapped));
      }
      return searchOverEntities(entities, canonical);
    },
  };
}
