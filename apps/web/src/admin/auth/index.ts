/** Administrator session verification, route policy, and staff permissions. */
export { AUTHORIZATION_HEADER, ServerAdminAuthorizationError } from './server-authorization';
export type {
  AdminPermission,
  AdminRequestHeaders,
  PrivilegedAdminAction,
} from './server-authorization';
export type { StaffRole } from './staff-permissions';
export {
  StaffPermissionDeniedError,
  assertStaffPermission,
  permissionsForStaffRole,
  staffRoleHasPermission,
} from './staff-permissions';
export {
  ADMIN_ROUTE_RULES,
  AdminRouteUndeclaredError,
  STAFF_READ,
  findAdminRouteAccess,
  type AdminRouteAccess,
  type AdminRouteRule,
} from './route-permissions';
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
export {
  authorizeAdminRequest,
  authorizeAdminRoute,
  authErrorResponse,
  createAdminRouteAuthorizer,
  isAdminAuthorizationError,
  type ResolvedAdminCaller,
} from './request-auth';
