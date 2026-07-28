/**
 * Postgres-only public projection facade. Release JSON artifacts remain a read-through cache,
 * but canonical live reads always come from `bb_public.*`.
 */
import * as postgresReaders from './postgres-readers';

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
export const listPublicLegalSnapshots = postgresReaders.listPublicLegalSnapshots;
export const fetchMaterializedSnapshot = postgresReaders.fetchMaterializedSnapshot;
