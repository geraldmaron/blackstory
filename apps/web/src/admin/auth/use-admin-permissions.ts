/**
 * Client helpers for role-aware admin UI (display only — server always re-authorizes).
 * Without decoded custom claims, signed-in operators are treated as research-capable locally.
 */
'use client';

import { useAdminAuth } from './AdminAuthProvider';
import type { AdminPermission } from './server-authorization';
import { permissionsForStaffRole } from './staff-permissions';

export type AdminUiRole = 'admin' | 'research' | 'publication' | 'security' | 'operator';

/**
 * Derived from the server's table so hidden affordances and enforced permissions cannot drift.
 * `operator` is the local stand-in for a signed-in user whose claims have not been decoded yet;
 * it is deliberately the narrowest set, and the server re-checks the real role regardless.
 */
const PERMISSION_BY_ROLE: Readonly<Record<AdminUiRole, ReadonlySet<AdminPermission>>> = {
  admin: new Set(permissionsForStaffRole('admin')),
  research: new Set(permissionsForStaffRole('research')),
  publication: new Set(permissionsForStaffRole('publication')),
  security: new Set(permissionsForStaffRole('security')),
  operator: new Set(['research:write']),
};

export function useAdminPermissions() {
  const { user } = useAdminAuth();
  const roles: readonly AdminUiRole[] = user ? ['operator'] : [];

  function can(permission: AdminPermission): boolean {
    if (!user) return false;
    for (const role of roles) {
      if (PERMISSION_BY_ROLE[role].has(permission)) return true;
    }
    return false;
  }

  return {
    roles,
    can,
    canResearch: can('research:write'),
    canPublish: can('publication:publish'),
    canRetract: can('publication:retract'),
    canChangePolicy: can('policy:change'),
  };
}
