/**
 * Postgres-only public projection facade. Release JSON artifacts remain a read-through cache,
 * but canonical live reads always come from `bb_public.*`.
 */
import { getSeedStoryProjection, listSeedStoryProjections } from '@repo/domain';
import type { PublicStoryListItemDoc, PublicStoryProjectionDoc } from '@repo/schemas';
import * as postgresReaders from './postgres-readers';
import { toStoryListItem } from './projection-contracts';

export { shouldUseLivePublicProjections } from './live-policy';
export {
  parseActiveRelease,
  parseEntityProjection,
  parseSearchProjection as parseSearchIndexDoc,
  parseStoryProjection,
  parseStoryListItem,
  toStoryListItem,
} from './projection-contracts';

export const fetchActiveRelease = postgresReaders.fetchActiveRelease;
export const fetchPublicEntityProjection = postgresReaders.fetchPublicEntityProjection;
export const listPublicEntityProjections = postgresReaders.listPublicEntityProjections;
export const fetchPublicEntityProjectionsByIds = postgresReaders.fetchPublicEntityProjectionsByIds;
export const listPublicSearchIndexDocs = postgresReaders.listPublicSearchIndexDocs;
export const fetchPublicStoryProjection = postgresReaders.fetchPublicStoryProjection;
export const listPublicStoryProjections = postgresReaders.listPublicStoryProjections;
export const listPublicStorySummaries = postgresReaders.listPublicStorySummaries;
export const fetchMaterializedSnapshot = postgresReaders.fetchMaterializedSnapshot;

export function listSnapshotStoryProjections(): readonly PublicStoryProjectionDoc[] {
  return listSeedStoryProjections();
}

export function listSnapshotStoryListItems(): readonly PublicStoryListItemDoc[] {
  return listSeedStoryProjections().map(toStoryListItem);
}

export function getSnapshotStoryProjection(slug: string): PublicStoryProjectionDoc | undefined {
  return getSeedStoryProjection(slug);
}
