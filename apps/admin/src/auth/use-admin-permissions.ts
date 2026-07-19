/**
 * Client helpers for role-aware admin UI (display only — server always re-authorizes).
 * Without decoded custom claims, signed-in operators are treated as research-capable locally.
 */
'use client';

import { useAdminAuth } from './AdminAuthProvider';
import type { AdminPermission } from './server-authorization';

export type AdminUiRole = 'admin' | 'research' | 'publication' | 'security' | 'operator';

const PERMISSION_BY_ROLE: Readonly<Record<AdminUiRole, ReadonlySet<AdminPermission>>> = {
  admin: new Set([
    'research:write',
    'publication:publish',
    'publication:retract',
    'rights:change',
    'policy:change',
    'export:privileged',
    'roles:change',
  ]),
  research: new Set(['research:write']),
  publication: new Set(['publication:publish', 'publication:retract']),
  security: new Set(['rights:change', 'export:privileged']),
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
