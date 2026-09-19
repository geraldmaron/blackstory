/** Server-only Postgres persistence, transactions and publication helpers. */
export { DATA_ACCESS_PACKAGE } from './package-id.js';
export { assertServerOnly } from './server-only.js';
export {
  __resetOpsPostgresPoolForTests,
  assertNoBrowserDatabaseCredentials,
  commitWithAudit,
  createLiveAtomicStoreFromEnv,
  createPostgresAtomicStore,
  getOpsPostgresPool,
  isOpsPostgresDataSource,
  ledgerPaths,
  normalizePgConnectionString,
  resolveOpsDataSource,
  resolvePostgresConnectionString,
} from './postgres/index.js';
export type {
  AtomicSnapshot,
  AtomicStore,
  AtomicTransaction,
  CommitWithAuditInput,
  CommitWithAuditResult,
  StateMutation,
} from './postgres/index.js';
