/**
 * Public exports for @repo/migrate-firestore-postgres.
 */
export { COLLECTION_SPECS, LIVE_ONLY_COLLECTIONS, allKnownFirestoreCollections } from './catalog.js';
export type { CollectionSpec, MigratePriority } from './catalog.js';
export { createPgWriter } from './pg-writer.js';
export type { PgWriter } from './pg-writer.js';
export {
  HIGH_VALUE_MIGRANTS,
  migrateAuditEvents,
  migrateCensusNational,
  migrateCensusState,
  migrateEvidenceSources,
  migrateIdempotencyKeys,
  migrateKillSwitches,
  migrateOutbox,
  migratePolicy,
  migratePolicyVersions,
  migratePublicMeta,
  migratePublicReleaseProjections,
  migratePublicSearchIndex,
  migratePublicationReleases,
  migrateResearchCases,
  migrateRetrievalEvents,
  migrateSourceCaptures,
  migrateSourceItems,
  migrateStoryPacketReviews,
  migrateSubmissions,
  runCensus,
} from './migrate.js';
export type { MigrateMode, MigrateOptions } from './migrate.js';
export type { CollectionMigrateResult } from './util.js';
export * from './mappers/index.js';
