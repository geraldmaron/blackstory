/**
 * SQL Connect Data Connect operation allowlist with explicit authorization metadata.
 * Every deployable operation must appear here before runtime use (ADR-003).
 */
import type { DatabaseRole } from '../roles.js';
import { assertServerOnly } from '../server-only.js';

export const SQL_CONNECT_AUTH_LEVELS = ['NO_ACCESS'] as const;
export type SqlConnectAuthLevel = (typeof SQL_CONNECT_AUTH_LEVELS)[number];

export const SQL_CONNECT_CONNECTORS = [
  'public-read',
  'submissions',
  'admin',
  'publication',
] as const;
export type SqlConnectConnectorId = (typeof SQL_CONNECT_CONNECTORS)[number];

export type SqlConnectOperation = {
  readonly connectorId: SqlConnectConnectorId;
  readonly operationName: string;
  readonly operationType: 'query' | 'mutation';
  readonly authLevel: SqlConnectAuthLevel;
  readonly databaseRole: DatabaseRole;
  readonly allowedSurfaces: readonly string[];
  readonly browserAllowed: false;
  readonly notes: string;
};

/**
 * Allowlist mirrors infra/database/sql-connect connectors.
 * authLevel is always NO_ACCESS: only Admin SDK privileged servers may execute.
 */
export const SQL_CONNECT_OPERATIONS: readonly SqlConnectOperation[] = [
  {
    connectorId: 'public-read',
    operationName: 'ListReleasedEntities',
    operationType: 'query',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_public_read',
    allowedSurfaces: ['apps/api-public'],
    browserAllowed: false,
    notes: 'Released projection list for public API only',
  },
  {
    connectorId: 'public-read',
    operationName: 'GetReleasedEntityBySlug',
    operationType: 'query',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_public_read',
    allowedSurfaces: ['apps/api-public'],
    browserAllowed: false,
    notes: 'Released projection detail for public API only',
  },
  {
    connectorId: 'submissions',
    operationName: 'CreateIntakeItem',
    operationType: 'mutation',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_submissions_write',
    allowedSurfaces: ['apps/api-submissions'],
    browserAllowed: false,
    notes: 'Quarantine intake only; cannot publish',
  },
  {
    connectorId: 'admin',
    operationName: 'ListReleaseManifests',
    operationType: 'query',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_admin_app',
    allowedSurfaces: ['apps/admin'],
    browserAllowed: false,
    notes: 'Admin read of release manifests behind IAP',
  },
  {
    connectorId: 'publication',
    operationName: 'UpsertReleaseManifest',
    operationType: 'mutation',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_publication',
    allowedSurfaces: ['apps/api-internal', 'workers/publication'],
    browserAllowed: false,
    notes: 'Create/update release metadata',
  },
  {
    connectorId: 'publication',
    operationName: 'ActivateRelease',
    operationType: 'mutation',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_publication',
    allowedSurfaces: ['apps/api-internal', 'workers/publication'],
    browserAllowed: false,
    notes: 'Activate a release pointer',
  },
  {
    connectorId: 'publication',
    operationName: 'PublishReleasedEntity',
    operationType: 'mutation',
    authLevel: 'NO_ACCESS',
    databaseRole: 'role_publication',
    allowedSurfaces: ['apps/api-internal', 'workers/publication'],
    browserAllowed: false,
    notes: 'Write released public projection row',
  },
];

export function listSqlConnectOperations(): readonly SqlConnectOperation[] {
  return SQL_CONNECT_OPERATIONS;
}

export function getSqlConnectOperation(
  connectorId: SqlConnectConnectorId,
  operationName: string,
): SqlConnectOperation {
  assertServerOnly('getSqlConnectOperation');
  const found = SQL_CONNECT_OPERATIONS.find(
    (operation) =>
      operation.connectorId === connectorId && operation.operationName === operationName,
  );
  if (!found) {
    throw new Error(`SQL Connect operation not allowlisted: ${connectorId}.${operationName}`);
  }
  return found;
}

export function assertOperationAuthorized(options: {
  readonly connectorId: SqlConnectConnectorId;
  readonly operationName: string;
  readonly surface: string;
  readonly databaseRole: DatabaseRole;
}): SqlConnectOperation {
  assertServerOnly('assertOperationAuthorized');
  const operation = getSqlConnectOperation(options.connectorId, options.operationName);
  if (operation.browserAllowed) {
    throw new Error('Browser SQL Connect access is forbidden');
  }
  if (operation.authLevel !== 'NO_ACCESS') {
    throw new Error(`Unexpected auth level ${operation.authLevel}; expected NO_ACCESS`);
  }
  if (!operation.allowedSurfaces.includes(options.surface)) {
    throw new Error(
      `Surface ${options.surface} is not authorized for ${options.connectorId}.${options.operationName}`,
    );
  }
  if (operation.databaseRole !== options.databaseRole) {
    throw new Error(
      `Role ${options.databaseRole} does not match operation role ${operation.databaseRole}`,
    );
  }
  return operation;
}
