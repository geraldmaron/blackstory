/**
 * Auth custom-claim helpers for Black Book staff roles (BB-027 will mint claims).
 */
import type { AuthClaimFlags } from './types.js';

export type StaffRole = 'admin' | 'research' | 'publication' | 'security';

export function resolveStaffRoles(claims: AuthClaimFlags | null | undefined): StaffRole[] {
  if (!claims) return [];
  const roles = new Set<StaffRole>();
  if (claims.admin === true || claims.bb_role === 'admin') roles.add('admin');
  if (claims.research === true || claims.bb_role === 'research') roles.add('research');
  if (claims.publication === true || claims.bb_role === 'publication') roles.add('publication');
  if (claims.security === true || claims.bb_role === 'security') roles.add('security');
  if (roles.has('admin')) {
    roles.add('research');
    roles.add('publication');
    roles.add('security');
  }
  return [...roles];
}

export function canPublish(claims: AuthClaimFlags | null | undefined): boolean {
  const roles = resolveStaffRoles(claims);
  return roles.includes('publication') || roles.includes('admin');
}

export function canResearchWrite(claims: AuthClaimFlags | null | undefined): boolean {
  const roles = resolveStaffRoles(claims);
  return roles.includes('research') || roles.includes('admin');
}

/** Research must never be treated as sufficient for publish. */
export function researchMayPublish(claims: AuthClaimFlags | null | undefined): boolean {
  if (!claims) return false;
  if (claims.bb_role === 'research' && claims.publication !== true && claims.admin !== true) {
    return false;
  }
  return canPublish(claims) && claims.bb_role !== 'research';
}
