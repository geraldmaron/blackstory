/**
 * @black-book/data-access — server-only data access helpers.
 *
 * Primary path (ADR-011 / D-014): Firestore collection maps and publish guards.
 * Deferred path (BB-012 parked): Postgres roles, pool, SQL Connect allowlists —
 * see DEFERRED.md and infra/database/README.md. Do not provision Cloud SQL.
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

/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export {
  APPLICATION_SCHEMAS,
  DATABASE_ROLES,
  ROLE_SCHEMA_MATRIX,
  assertRoleIsolationInvariants,
  isDatabaseRole,
  roleMayAccess,
} from './roles.js';
/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export type { ApplicationSchema, DatabaseRole, RolePrivilege } from './roles.js';
/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export {
  assertNoBrowserDatabaseCredentials,
  parseDatabaseConfig,
  resolveConnectionString,
} from './config.js';
/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export type { DatabaseConfig } from './config.js';
/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export {
  allowedSearchPath,
  assertReadAllowed,
  assertWriteAllowed,
  buildSessionSetupSql,
} from './session.js';
/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export { ConnectionPool, PoolExhaustedError, simulateConnectionExhaustion } from './pool.js';
/** @deprecated Parked Postgres helpers — not the production path (ADR-011). */
export type { ClientFactory, ConnectionPoolOptions, PooledClient } from './pool.js';
/** @deprecated Parked SQL Connect helpers — not the production path (ADR-011). */
export {
  SQL_CONNECT_AUTH_LEVELS,
  SQL_CONNECT_CONNECTORS,
  SQL_CONNECT_OPERATIONS,
  assertOperationAuthorized,
  getSqlConnectOperation,
  listSqlConnectOperations,
} from './sql-connect/operations.js';
/** @deprecated Parked SQL Connect helpers — not the production path (ADR-011). */
export type {
  SqlConnectAuthLevel,
  SqlConnectConnectorId,
  SqlConnectOperation,
} from './sql-connect/operations.js';
/** @deprecated Parked SQL Connect helpers — not the production path (ADR-011). */
export { SQL_CONNECT_SDK_STATUS, loadGeneratedAdminSdk } from './sql-connect/generated-stub.js';
