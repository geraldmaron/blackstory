/**
 * Exposes server-side administrator authorization and role-mutation composition helpers.
 */
export {
  AUTHORIZATION_HEADER,
  IAP_ASSERTION_HEADER,
  ServerAdminAuthorizationError,
  createServerAdminAuthorizer,
} from './server-authorization';
export type {
  AdminAuthorizationPolicy,
  AdminPermission,
  AdminRequestHeaders,
  AuthorizedAdminRequest,
  AdminTokenVerifier,
  IapAssertionVerifier,
  PrivilegedAdminAction,
  ServerAdminAuthorizationOptions,
  VerifiedAdminIdentity,
  VerifiedIapPrincipal,
} from './server-authorization';
export { mutateAdminRoles } from './role-mutation';
export type {
  AdminRoleMutationService,
  PrivilegedActionAuthorizer,
  StaffRole,
} from './role-mutation';
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
