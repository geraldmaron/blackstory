/**
 * The one place the site's data layer reaches into apps/web for Next-independent modules. Everything
 * re-exported here is plain TypeScript (no `next/*`, no React `cache`); moving a file here when apps/web
 * is removed is a `git mv` plus editing this list. Do not import apps/web/src from anywhere else.
 */
export {
  fetchActiveRelease,
  listPublicSearchIndexDocs,
} from '../../../../web/src/lib/public-data/postgres-readers';
export { parseSearchProjection } from '../../../../web/src/lib/public-data/projection-contracts';
export { mapPublicSearchProjection } from '../../../../web/src/lib/public-data/map-search-index';
export {
  hasPostgresConnection,
  shouldPreferReleaseArtifacts,
  shouldUseLivePublicProjections,
} from '../../../../web/src/lib/public-data/live-policy';
export {
  buildRecordsIndex,
  searchIndexReadyForRecords,
  type RecordsIndex,
} from '../../../../web/src/lib/records/build-records-index';
export {
  EMPTY_RECORDS_QUERY,
  parseRecordsQuery,
  recordsHref,
  type RecordsQuery,
} from '../../../../web/src/lib/records/records-query';
