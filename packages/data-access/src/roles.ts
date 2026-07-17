/**
 * Postgres role identifiers aligned with infra/database/ROLE_MATRIX.md and SA matrix.
 */
export const DATABASE_ROLES = [
  'role_public_read',
  'role_submissions_write',
  'role_admin_app',
  'role_research',
  'role_publication',
  'role_migrations',
  'role_backup_readonly',
  'role_security',
] as const;

export type DatabaseRole = (typeof DATABASE_ROLES)[number];

export const APPLICATION_SCHEMAS = [
  'bb_public',
  'bb_submissions',
  'bb_research',
  'bb_evidence',
  'bb_publication',
  'bb_admin',
  'bb_audit',
  'bb_migrations',
] as const;

export type ApplicationSchema = (typeof APPLICATION_SCHEMAS)[number];

export type RolePrivilege = 'read' | 'write' | 'none';

/** Schema privilege matrix used by session guards and static tests. */
export const ROLE_SCHEMA_MATRIX: Readonly<
  Record<DatabaseRole, Readonly<Record<ApplicationSchema, RolePrivilege>>>
> = {
  role_public_read: {
    bb_public: 'read',
    bb_submissions: 'none',
    bb_research: 'none',
    bb_evidence: 'none',
    bb_publication: 'none',
    bb_admin: 'none',
    bb_audit: 'none',
    bb_migrations: 'none',
  },
  role_submissions_write: {
    bb_public: 'none',
    bb_submissions: 'write',
    bb_research: 'none',
    bb_evidence: 'none',
    bb_publication: 'none',
    bb_admin: 'none',
    bb_audit: 'none',
    bb_migrations: 'none',
  },
  role_admin_app: {
    bb_public: 'read',
    bb_submissions: 'none',
    bb_research: 'none',
    bb_evidence: 'none',
    bb_publication: 'read',
    bb_admin: 'write',
    bb_audit: 'write',
    bb_migrations: 'none',
  },
  role_research: {
    bb_public: 'none',
    bb_submissions: 'none',
    bb_research: 'write',
    bb_evidence: 'write',
    bb_publication: 'none',
    bb_admin: 'none',
    bb_audit: 'none',
    bb_migrations: 'none',
  },
  role_publication: {
    bb_public: 'write',
    bb_submissions: 'none',
    bb_research: 'none',
    bb_evidence: 'read',
    bb_publication: 'write',
    bb_admin: 'none',
    bb_audit: 'none',
    bb_migrations: 'none',
  },
  role_migrations: {
    bb_public: 'write',
    bb_submissions: 'write',
    bb_research: 'write',
    bb_evidence: 'write',
    bb_publication: 'write',
    bb_admin: 'write',
    bb_audit: 'write',
    bb_migrations: 'write',
  },
  role_backup_readonly: {
    bb_public: 'read',
    bb_submissions: 'read',
    bb_research: 'read',
    bb_evidence: 'read',
    bb_publication: 'read',
    bb_admin: 'read',
    bb_audit: 'read',
    bb_migrations: 'read',
  },
  role_security: {
    bb_public: 'none',
    bb_submissions: 'write',
    bb_research: 'none',
    bb_evidence: 'write',
    bb_publication: 'none',
    bb_admin: 'none',
    bb_audit: 'none',
    bb_migrations: 'none',
  },
};

export function isDatabaseRole(value: string): value is DatabaseRole {
  return (DATABASE_ROLES as readonly string[]).includes(value);
}

export function roleMayAccess(
  role: DatabaseRole,
  schema: ApplicationSchema,
  mode: 'read' | 'write',
): boolean {
  const privilege = ROLE_SCHEMA_MATRIX[role][schema];
  if (mode === 'read') {
    return privilege === 'read' || privilege === 'write';
  }
  return privilege === 'write';
}

/** Invariants from product constitution / ADR-003 expressed as matrix assertions. */
export function assertRoleIsolationInvariants(): void {
  if (roleMayAccess('role_research', 'bb_public', 'write')) {
    throw new Error('role_research must not write bb_public');
  }
  if (roleMayAccess('role_research', 'bb_publication', 'write')) {
    throw new Error('role_research must not write bb_publication');
  }
  if (roleMayAccess('role_publication', 'bb_evidence', 'write')) {
    throw new Error('role_publication must not write bb_evidence');
  }
  if (roleMayAccess('role_public_read', 'bb_public', 'write')) {
    throw new Error('role_public_read must be read-only on bb_public');
  }
  if (roleMayAccess('role_public_read', 'bb_evidence', 'read')) {
    throw new Error('role_public_read must not read bb_evidence');
  }
  if (roleMayAccess('role_submissions_write', 'bb_publication', 'write')) {
    throw new Error('role_submissions_write must not write bb_publication');
  }
}
