/**
 * Public projection reader facade: routes live reads to Postgres (`bb_public`) or Firestore
 * based on `PUBLIC_DATA_SOURCE`. Parsers and bundled seed fallbacks stay in firestore-readers.
 */
import { isPostgresPublicDataSource } from './live-policy';
import * as firestoreReaders from './firestore-readers';
import * as postgresReaders from './postgres-readers';

export { shouldUseLivePublicProjections } from './live-policy';

export {
  FIRESTORE_GET_ALL_CHUNK_SIZE,
  parseActiveRelease,
  parseEntityProjection,
  parseSearchIndexDoc,
  parseStoryProjection,
  parseStoryListItem,
  toStoryListItem,
  listSnapshotStoryProjections,
  listSnapshotStoryListItems,
  getSnapshotStoryProjection,
} from './firestore-readers';

function usePostgres(): boolean {
  return isPostgresPublicDataSource();
}

export async function fetchActiveRelease(): Promise<
  ReturnType<typeof firestoreReaders.fetchActiveRelease> extends Promise<infer T> ? T : never
> {
  return usePostgres()
    ? postgresReaders.fetchActiveRelease()
    : firestoreReaders.fetchActiveRelease();
}

export async function fetchPublicEntityProjection(
  releaseId: string,
  entityId: string,
): Promise<
  ReturnType<typeof firestoreReaders.fetchPublicEntityProjection> extends Promise<infer T>
    ? T
    : never
> {
  return usePostgres()
    ? postgresReaders.fetchPublicEntityProjection(releaseId, entityId)
    : firestoreReaders.fetchPublicEntityProjection(releaseId, entityId);
}

export async function listPublicEntityProjections(
  releaseId: string,
): Promise<
  ReturnType<typeof firestoreReaders.listPublicEntityProjections> extends Promise<infer T> ? T : never
> {
  return usePostgres()
    ? postgresReaders.listPublicEntityProjections(releaseId)
    : firestoreReaders.listPublicEntityProjections(releaseId);
}

export async function fetchPublicEntityProjectionsByIds(
  releaseId: string,
  entityIds: readonly string[],
): Promise<
  ReturnType<typeof firestoreReaders.fetchPublicEntityProjectionsByIds> extends Promise<infer T>
    ? T
    : never
> {
  return usePostgres()
    ? postgresReaders.fetchPublicEntityProjectionsByIds(releaseId, entityIds)
    : firestoreReaders.fetchPublicEntityProjectionsByIds(releaseId, entityIds);
}

export async function listPublicSearchIndexDocs(
  releaseId: string,
): Promise<
  ReturnType<typeof firestoreReaders.listPublicSearchIndexDocs> extends Promise<infer T> ? T : never
> {
  return usePostgres()
    ? postgresReaders.listPublicSearchIndexDocs(releaseId)
    : firestoreReaders.listPublicSearchIndexDocs(releaseId);
}

export async function fetchPublicStoryProjection(
  releaseId: string,
  slug: string,
): Promise<
  ReturnType<typeof firestoreReaders.fetchPublicStoryProjection> extends Promise<infer T> ? T : never
> {
  return usePostgres()
    ? postgresReaders.fetchPublicStoryProjection(releaseId, slug)
    : firestoreReaders.fetchPublicStoryProjection(releaseId, slug);
}

export async function listPublicStoryProjections(
  releaseId: string,
): Promise<
  ReturnType<typeof firestoreReaders.listPublicStoryProjections> extends Promise<infer T> ? T : never
> {
  return usePostgres()
    ? postgresReaders.listPublicStoryProjections(releaseId)
    : firestoreReaders.listPublicStoryProjections(releaseId);
}

export async function listPublicStorySummaries(
  releaseId: string,
): Promise<
  ReturnType<typeof firestoreReaders.listPublicStorySummaries> extends Promise<infer T> ? T : never
> {
  return usePostgres()
    ? postgresReaders.listPublicStorySummaries(releaseId)
    : firestoreReaders.listPublicStorySummaries(releaseId);
}

export async function fetchMaterializedSnapshot(name: string): Promise<unknown | undefined> {
  if (!usePostgres()) return undefined;
  return postgresReaders.fetchMaterializedSnapshot(name);
}
