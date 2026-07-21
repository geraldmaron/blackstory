/**
 * Postgres SoR helpers for ops AtomicStore, data-source selection, and pool lifecycle.
 */
export {
  resolveOpsDataSource,
  isOpsPostgresDataSource,
  type OpsDataSource,
} from './data-source.js';
export {
  assertNoBrowserDatabaseCredentials,
  resolvePostgresConnectionString,
  normalizePgConnectionString,
  getOpsPostgresPool,
  __resetOpsPostgresPoolForTests,
} from './pool.js';
export { createPostgresAtomicStore, createLiveAtomicStoreFromEnv } from './atomic-store.js';
export { commitWithAudit } from './audit-outbox.js';
export type {
  AtomicSnapshot,
  AtomicStore,
  AtomicTransaction,
  CommitWithAuditInput,
  CommitWithAuditResult,
  StateMutation,
} from './audit-outbox.js';
export { ledgerPaths } from './ledger-paths.js';
export {
  applyPostgresDocumentMutation,
  readPostgresDocument,
  decodeIdempotencyDocId,
} from './path-write.js';
