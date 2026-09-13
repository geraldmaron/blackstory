/**
 * @repo/data-access server-only data access helpers.
 *
 * Primary path: Supabase Postgres, exported from `./postgres/`. The Firestore collection maps
 * and publish guards below are leftover: nothing outside this package's own test imports them.
 * Parked path: Cloud SQL roles, session, pool, SQL Connect allowlists. See DEFERRED.md and
 * infra/database/README.md. Do not provision Cloud SQL.
 * Background: docs/decisions-carryover.md, "Firestore as system of record, reversed".
 */
export { DATA_ACCESS_PACKAGE } from './package-id.js';
export { assertServerOnly } from './server-only.js';

export {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_PATHS,
  assertStaffMayPublish,
  assertNotResearchPublish,
} from './firestore/access.js';
export type { FirestoreCollectionId, StaffClaims } from './firestore/access.js';

/** @deprecated Cloud SQL role foundation; unused. See DEFERRED.md.  */
export {
  APPLICATION_SCHEMAS,
  DATABASE_ROLES,
  ROLE_SCHEMA_MATRIX,
  assertRoleIsolationInvariants,
  isDatabaseRole,
  roleMayAccess,
} from './roles.js';
/** @deprecated Cloud SQL role foundation; unused. See DEFERRED.md.  */
export type { ApplicationSchema, DatabaseRole, RolePrivilege } from './roles.js';
/**
 * @deprecated `parseDatabaseConfig` and `resolveConnectionString` are Cloud SQL era (they
 * require APP_DB_ROLE from `./roles.js`). `assertNoBrowserDatabaseCredentials` is NOT: it has
 * been hand-copied into four other files because this marker reads as a ban. Prefer reusing it.
 */
export {
  assertNoBrowserDatabaseCredentials,
  parseDatabaseConfig,
  resolveConnectionString,
} from './config.js';
/** @deprecated Cloud SQL era config shape; unused. See DEFERRED.md.  */
export type { DatabaseConfig } from './config.js';
/** @deprecated Cloud SQL session setup; unused. See DEFERRED.md.  */
export {
  allowedSearchPath,
  assertReadAllowed,
  assertWriteAllowed,
  buildSessionSetupSql,
} from './session.js';
/** @deprecated Cloud SQL era pool; the live pool is `./postgres/`. See DEFERRED.md.  */
export { ConnectionPool, PoolExhaustedError, simulateConnectionExhaustion } from './pool.js';
/** @deprecated Cloud SQL era pool types; the live pool is `./postgres/`. See DEFERRED.md.  */
export type { ClientFactory, ConnectionPoolOptions, PooledClient } from './pool.js';
/** @deprecated Firebase SQL Connect; never provisioned, unused. See DEFERRED.md.  */
export {
  SQL_CONNECT_AUTH_LEVELS,
  SQL_CONNECT_CONNECTORS,
  SQL_CONNECT_OPERATIONS,
  assertOperationAuthorized,
  getSqlConnectOperation,
  listSqlConnectOperations,
} from './sql-connect/operations.js';
/** @deprecated Firebase SQL Connect; never provisioned, unused. See DEFERRED.md.  */
export type {
  SqlConnectAuthLevel,
  SqlConnectConnectorId,
  SqlConnectOperation,
} from './sql-connect/operations.js';
/** @deprecated Firebase SQL Connect; never provisioned, unused. See DEFERRED.md.  */
export { SQL_CONNECT_SDK_STATUS, loadGeneratedAdminSdk } from './sql-connect/generated-stub.js';

export {
  __resetOpsPostgresPoolForTests,
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
