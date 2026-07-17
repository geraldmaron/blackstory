/**
 * Session guards that pin search_path and refuse cross-role schema writes.
 */
import {
  type ApplicationSchema,
  type DatabaseRole,
  type RolePrivilege,
  ROLE_SCHEMA_MATRIX,
  roleMayAccess,
} from './roles.js';
import { assertServerOnly } from './server-only.js';

export type SessionGuardOptions = {
  readonly role: DatabaseRole;
  readonly schemas?: readonly ApplicationSchema[];
};

export function allowedSearchPath(role: DatabaseRole): ApplicationSchema[] {
  return (Object.entries(ROLE_SCHEMA_MATRIX[role]) as [ApplicationSchema, RolePrivilege][])
    .filter(([, privilege]) => privilege !== 'none')
    .map(([schema]) => schema);
}

export function buildSessionSetupSql(options: SessionGuardOptions): string[] {
  assertServerOnly('buildSessionSetupSql');
  const path = options.schemas ?? allowedSearchPath(options.role);
  if (path.length === 0) {
    throw new Error(`Role ${options.role} has no allowed schemas`);
  }
  for (const schema of path) {
    if (!roleMayAccess(options.role, schema, 'read')) {
      throw new Error(`Role ${options.role} cannot use schema ${schema}`);
    }
  }
  return [`SET ROLE ${options.role}`, `SET search_path TO ${path.join(', ')}`];
}

export function assertWriteAllowed(role: DatabaseRole, schema: ApplicationSchema): void {
  assertServerOnly('assertWriteAllowed');
  if (!roleMayAccess(role, schema, 'write')) {
    throw new Error(`Role ${role} is not permitted to write schema ${schema}`);
  }
}

export function assertReadAllowed(role: DatabaseRole, schema: ApplicationSchema): void {
  assertServerOnly('assertReadAllowed');
  if (!roleMayAccess(role, schema, 'read')) {
    throw new Error(`Role ${role} is not permitted to read schema ${schema}`);
  }
}
