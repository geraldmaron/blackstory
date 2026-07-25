/**
 * Defines administrator custom claims, server authorization gates, recent-authentication
 * requirements, session revocation operations, and authentication alert contracts.
 */
import type { Auth } from 'firebase-admin/auth';
import { resolveStaffRoles, type StaffRole } from './firestore/claims.js';
import type { AuthClaimFlags } from './firestore/types.js';

export const ADMIN_CLAIMS_VERSION = 1 as const;
export const DEFAULT_REAUTH_MAX_AGE_SECONDS = 10 * 60;

export const ADMIN_PERMISSIONS = [
  'research:write',
  'publication:publish',
  'publication:retract',
  'rights:change',
  'policy:change',
  'export:privileged',
  'roles:change',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export type PrivilegedAdminAction =
  | 'publication'
  | 'retraction'
  | 'rights_change'
  | 'policy_change'
  | 'privileged_export'
  | 'role_change';

export type AdminCustomClaims = AuthClaimFlags & {
  readonly bb_claims_version: typeof ADMIN_CLAIMS_VERSION;
  readonly bb_roles: readonly StaffRole[];
};

export type VerifiedAdminToken = AuthClaimFlags & {
  readonly uid: string;
  readonly email?: string;
  readonly auth_time: number;
  readonly iat?: number;
  readonly bb_claims_version?: number;
  readonly bb_roles?: readonly unknown[];
  readonly amr?: readonly string[];
  readonly firebase?: {
    readonly sign_in_provider?: string;
    readonly sign_in_second_factor?: string;
  };
};

export type RoleMutationAuthPort = Pick<
  Auth,
  'getUser' | 'revokeRefreshTokens' | 'setCustomUserClaims'
>;
export type SessionRevocationAuthPort = Pick<Auth, 'getUser' | 'revokeRefreshTokens'>;

export type AdminAuthorizationErrorCode =
  | 'ADMIN_IDENTITY_REQUIRED'
  | 'ADMIN_MFA_REQUIRED'
  | 'ADMIN_PERMISSION_DENIED'
  | 'ADMIN_REAUTH_REQUIRED'
  | 'ADMIN_SESSION_REVOKED'
  | 'ADMIN_ROLE_MUTATION_INVALID';

export class AdminAuthorizationError extends Error {
  readonly code: AdminAuthorizationErrorCode;

  constructor(code: AdminAuthorizationErrorCode, message: string) {
    super(message);
    this.name = 'AdminAuthorizationError';
    this.code = code;
  }
}

const ROLE_PERMISSIONS: Readonly<Record<StaffRole, ReadonlySet<AdminPermission>>> = {
  research: new Set(['research:write']),
  publication: new Set(['publication:publish', 'publication:retract']),
  security: new Set(['rights:change', 'export:privileged']),
  admin: new Set(ADMIN_PERMISSIONS),
};

const ACTION_PERMISSION: Readonly<Record<PrivilegedAdminAction, AdminPermission>> = {
  publication: 'publication:publish',
  retraction: 'publication:retract',
  rights_change: 'rights:change',
  policy_change: 'policy:change',
  privileged_export: 'export:privileged',
  role_change: 'roles:change',
};

function isStaffRole(value: unknown): value is StaffRole {
  return (
    value === 'admin' || value === 'research' || value === 'publication' || value === 'security'
  );
}

function uniqueRoles(roles: readonly StaffRole[]): StaffRole[] {
  return [...new Set(roles)];
}

export function resolveAdminRoles(
  claims: (AuthClaimFlags & { readonly bb_roles?: readonly unknown[] }) | null | undefined,
): StaffRole[] {
  const roles = new Set(resolveStaffRoles(claims));
  for (const role of claims?.bb_roles ?? []) {
    if (isStaffRole(role)) roles.add(role);
  }
  if (roles.has('admin')) {
    roles.add('research');
    roles.add('publication');
    roles.add('security');
  }
  return [...roles];
}

export function resolveAdminPermissions(
  claims: (AuthClaimFlags & { readonly bb_roles?: readonly unknown[] }) | null | undefined,
): AdminPermission[] {
  const permissions = new Set<AdminPermission>();
  for (const role of resolveAdminRoles(claims)) {
    for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
  }
  return [...permissions];
}

export function buildAdminCustomClaims(roles: readonly StaffRole[]): AdminCustomClaims {
  const explicitRoles = uniqueRoles(roles);
  if (explicitRoles.length === 0) {
    throw new AdminAuthorizationError(
      'ADMIN_ROLE_MUTATION_INVALID',
      'At least one administrator role is required',
    );
  }
  return {
    bb_claims_version: ADMIN_CLAIMS_VERSION,
    bb_roles: explicitRoles,
  };
}

export function hasRequiredMfa(token: VerifiedAdminToken): boolean {
  return (
    Boolean(token.firebase?.sign_in_second_factor) ||
    token.amr?.some((method) => method === 'mfa') === true
  );
}

export function assertRequiredMfa(token: VerifiedAdminToken): void {
  if (!hasRequiredMfa(token)) {
    throw new AdminAuthorizationError(
      'ADMIN_MFA_REQUIRED',
      'Administrator access requires a multi-factor Firebase sign-in',
    );
  }
}

export function assertAdminIdentity(token: VerifiedAdminToken): void {
  if (!token.uid || resolveAdminRoles(token).length === 0) {
    throw new AdminAuthorizationError(
      'ADMIN_IDENTITY_REQUIRED',
      'A verified Firebase administrator identity is required',
    );
  }
  assertRequiredMfa(token);
}

export function assertAdminPermission(
  token: VerifiedAdminToken,
  permission: AdminPermission,
): void {
  assertAdminIdentity(token);
  if (!resolveAdminPermissions(token).includes(permission)) {
    throw new AdminAuthorizationError(
      'ADMIN_PERMISSION_DENIED',
      `Administrator permission "${permission}" is required`,
    );
  }
}

export type RecentReauthOptions = {
  readonly nowEpochSeconds?: number;
  readonly maxAgeSeconds?: number;
  readonly futureClockSkewSeconds?: number;
};

export function assertRecentReauth(
  token: VerifiedAdminToken,
  action: PrivilegedAdminAction,
  options: RecentReauthOptions = {},
): void {
  assertAdminPermission(token, ACTION_PERMISSION[action]);
  const now = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? DEFAULT_REAUTH_MAX_AGE_SECONDS;
  const futureClockSkew = options.futureClockSkewSeconds ?? 60;
  const age = now - token.auth_time;
  if (
    !Number.isSafeInteger(token.auth_time) ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < 0 ||
    age > maxAge ||
    age < -futureClockSkew
  ) {
    throw new AdminAuthorizationError(
      'ADMIN_REAUTH_REQUIRED',
      `Fresh authentication is required for ${action}`,
    );
  }
}

export function assertRoleMutationAuthorized(
  actor: VerifiedAdminToken,
  targetUid: string,
  nextRoles: readonly StaffRole[],
  options: RecentReauthOptions = {},
): void {
  assertRecentReauth(actor, 'role_change', options);
  if (!targetUid.trim() || uniqueRoles(nextRoles).length === 0) {
    throw new AdminAuthorizationError(
      'ADMIN_ROLE_MUTATION_INVALID',
      'Role changes require a target user and at least one role',
    );
  }
  if (actor.uid === targetUid && !nextRoles.includes('admin')) {
    throw new AdminAuthorizationError(
      'ADMIN_ROLE_MUTATION_INVALID',
      'Administrators cannot remove their own administrator role',
    );
  }
}

export async function setAdminRoles(
  auth: RoleMutationAuthPort,
  actor: VerifiedAdminToken,
  targetUid: string,
  nextRoles: readonly StaffRole[],
  options: RecentReauthOptions = {},
): Promise<AdminCustomClaims> {
  assertRoleMutationAuthorized(actor, targetUid, nextRoles, options);
  const claims = buildAdminCustomClaims(nextRoles);
  const user = await auth.getUser(targetUid);
  const roleClaimNames = new Set([
    'admin',
    'research',
    'publication',
    'security',
    'bb_role',
    'bb_roles',
    'bb_claims_version',
  ]);
  const preservedClaims = Object.fromEntries(
    Object.entries(user.customClaims ?? {}).filter(([name]) => !roleClaimNames.has(name)),
  );
  await auth.setCustomUserClaims(targetUid, { ...preservedClaims, ...claims });
  await auth.revokeRefreshTokens(targetUid);
  return claims;
}

export type SessionRevocation = {
  readonly uid: string;
  readonly revokedAfterEpochSeconds: number;
};

export async function revokeAdminSessions(
  auth: SessionRevocationAuthPort,
  uid: string,
): Promise<SessionRevocation> {
  if (!uid.trim()) {
    throw new AdminAuthorizationError(
      'ADMIN_IDENTITY_REQUIRED',
      'A target administrator uid is required',
    );
  }
  await auth.revokeRefreshTokens(uid);
  const user = await auth.getUser(uid);
  const revokedAfterEpochSeconds = user.tokensValidAfterTime
    ? Math.floor(Date.parse(user.tokensValidAfterTime) / 1000)
    : Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(revokedAfterEpochSeconds)) {
    throw new Error('Firebase returned an invalid session revocation timestamp');
  }
  return { uid, revokedAfterEpochSeconds };
}

export function assertSessionNotRevoked(
  token: VerifiedAdminToken,
  revokedAfterEpochSeconds: number,
): void {
  if (!Number.isSafeInteger(token.auth_time) || token.auth_time < revokedAfterEpochSeconds) {
    throw new AdminAuthorizationError(
      'ADMIN_SESSION_REVOKED',
      'Administrator session has been revoked',
    );
  }
}

type AdministrativeAuthAlertBase = {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly uid?: string;
  readonly email?: string;
  readonly deviceIdHash?: string;
  readonly sourceIpHash?: string;
};

export type AdministrativeAuthAlertEvent =
  | (AdministrativeAuthAlertBase & {
      readonly type: 'admin_login';
      readonly outcome: 'succeeded' | 'failed';
      readonly reason?: 'invalid_credentials' | 'mfa_failed' | 'iap_rejected' | 'unauthorized_role';
      readonly newDevice: boolean;
    })
  | (AdministrativeAuthAlertBase & {
      readonly type: 'admin_session_revoked';
      readonly outcome: 'succeeded';
      readonly actorUid: string;
    })
  | (AdministrativeAuthAlertBase & {
      readonly type: 'admin_roles_changed';
      readonly outcome: 'succeeded';
      readonly actorUid: string;
      readonly roles: readonly StaffRole[];
    });

export type AdministrativeAuthAlertSink = {
  emit(event: AdministrativeAuthAlertEvent): void | Promise<void>;
};

export async function emitAdministrativeAuthAlert(
  sink: AdministrativeAuthAlertSink,
  event: AdministrativeAuthAlertEvent,
): Promise<void> {
  await sink.emit(event);
}
