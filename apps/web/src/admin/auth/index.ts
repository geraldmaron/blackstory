/**
 * Exposes server-side administrator authorization and role-mutation composition helpers.
 */
export { AUTHORIZATION_HEADER, ServerAdminAuthorizationError } from './server-authorization';
export type {
  AdminPermission,
  AdminRequestHeaders,
  AuthorizedAdminRequest,
  PrivilegedAdminAction,
  VerifiedAdminIdentity,
  VerifiedIapPrincipal,
} from './server-authorization';
export { mutateAdminRoles } from './role-mutation';
export type {
  AdminRoleMutationService,
  PrivilegedActionAuthorizer,
  StaffRole,
} from './role-mutation';
export {
  StaffPermissionDeniedError,
  assertStaffPermission,
  permissionsForStaffRole,
  staffRoleHasPermission,
} from './staff-permissions';
export { resolveAdminAuthMode, resolveClientAdminAuthMode, type AdminAuthMode } from './mode';
export {
  SupabaseSessionAuthorizationError,
  createSupabaseSessionAuthorizer,
  readSupabaseRoleFromAppMetadata,
  readSupabaseServerConfig,
} from './supabase-session-authorizer';
export type {
  SupabaseSessionAuthorizedAdmin,
  SupabaseUserVerifier,
  VerifiedSupabaseAdminIdentity,
} from './supabase-session-authorizer';
export type { AdminSessionUser } from './session-user';
export { authorizeAdminRequest, authErrorResponse, type ResolvedAdminCaller } from './request-auth';
