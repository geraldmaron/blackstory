/**
 * Public exports for @repo/migrate-firestore-postgres.
 *
 * These exports are all part of the historical, one-time Firestore export path (live
 * firebase-admin/firestore calls). The ongoing Postgres-only utilities (canonical-release-gate.ts,
 * canonical-convergence.ts, pg-writer.ts) are consumed via direct relative imports by
 * packages/operator-cli and this package's own cli/backfill-canonical.ts — see README.md.
 */
export {
  COLLECTION_SPECS,
  LIVE_ONLY_COLLECTIONS,
  allKnownFirestoreCollections,
} from './catalog.js';
export type { CollectionSpec, MigratePriority } from './catalog.js';
export { createPgWriter } from './pg-writer.js';
export type { PgWriter } from './pg-writer.js';
export {
  ALL_MIGRANTS,
  HIGH_VALUE_MIGRANTS,
  LARGE_MIGRANTS,
  migrateAcsCounty,
  migrateAcsTracts,
  migrateAuditEvents,
  migrateCensusCounty,
  migrateCensusNational,
  migrateCensusState,
  migrateEntityEmbeddings,
  migrateEntityRelationships,
  migrateEvidenceSources,
  migrateHateCrime,
  migrateHolcAreas,
  migrateIdempotencyKeys,
  migrateKillSwitches,
  migrateOpportunityAtlas,
  migrateOutbox,
  migratePolicy,
  migratePolicyVersions,
  migratePublicMeta,
  migratePublicReleaseGraph,
  migratePublicReleaseProjections,
  migratePublicSearchIndex,
  migratePublicationReleases,
  migrateResearchCases,
  migrateRetrievalEvents,
  migrateSourceCaptures,
  migrateSourceItems,
  migrateStoryPacketReviews,
  migrateSubmissions,
  migrateUcrAgencies,
  migrateUcrStateParticipation,
  runCensus,
} from './migrate.js';
export type { MigrateMode, MigrateOptions } from './migrate.js';
export type { CollectionMigrateResult } from './util.js';
export * from './mappers/index.js';
