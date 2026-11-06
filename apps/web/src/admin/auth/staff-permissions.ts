/** Shared permission table for server authorization and client control visibility. */
import type { AdminPermission } from './server-authorization';
/**
 * `observer` reads the console and holds nothing else. It exists for development agents driving
 * the admin against the live database: see `scripts/admin-dev-session.mts`. Beyond its empty
 * permission set, `isReadOnlyStaffRole` fences it off every non-GET at the edge gate and the
 * route authorizer, so a handler that forgets its own check still cannot write for it.
 */
export type StaffRole = 'admin' | 'research' | 'publication' | 'security' | 'observer';

/**
 * Canonical writes are separated from `research:write` on purpose. Research writes propose;
 * canonical writes change the record the archive serves. Merge and bulk edits are separated
 * again because their blast radius is a whole filtered set, not one field.
 */
const PERMISSIONS_BY_STAFF_ROLE: Readonly<Record<StaffRole, readonly AdminPermission[]>> = {
  admin: [
    'research:write',
    'canonical:write',
    'canonical:merge',
    'canonical:bulk_write',
    'publication:publish',
    'publication:retract',
    'rights:change',
    'policy:change',
    'export:privileged',
    'roles:change',
  ],
  research: ['research:write', 'canonical:write'],
  publication: ['publication:publish', 'publication:retract'],
  security: ['rights:change', 'export:privileged'],
  observer: [],
};

const PERMISSION_SETS: Readonly<Record<StaffRole, ReadonlySet<AdminPermission>>> = {
  admin: new Set(PERMISSIONS_BY_STAFF_ROLE.admin),
  research: new Set(PERMISSIONS_BY_STAFF_ROLE.research),
  publication: new Set(PERMISSIONS_BY_STAFF_ROLE.publication),
  security: new Set(PERMISSIONS_BY_STAFF_ROLE.security),
  observer: new Set(PERMISSIONS_BY_STAFF_ROLE.observer),
};

/** A role that may never send a mutating request, whatever a route's own rule says. */
export function isReadOnlyStaffRole(role: StaffRole): boolean {
  return role === 'observer';
}

/** GET and HEAD read; every other method can change something. */
export function isReadMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

export function permissionsForStaffRole(role: StaffRole): readonly AdminPermission[] {
  return PERMISSIONS_BY_STAFF_ROLE[role] ?? [];
}

export function staffRoleHasPermission(role: StaffRole, permission: AdminPermission): boolean {
  return PERMISSION_SETS[role]?.has(permission) ?? false;
}

export class StaffPermissionDeniedError extends Error {
  readonly role: StaffRole;
  readonly permission: AdminPermission;

  constructor(role: StaffRole, permission: AdminPermission) {
    super(`Role ${role} does not have ${permission}`);
    this.name = 'StaffPermissionDeniedError';
    this.role = role;
    this.permission = permission;
  }
}

export function assertStaffPermission(role: StaffRole, permission: AdminPermission): void {
  if (!staffRoleHasPermission(role, permission)) {
    throw new StaffPermissionDeniedError(role, permission);
  }
}
