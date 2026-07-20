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
  FirebaseAdminTokenVerifier,
  IapAssertionVerifier,
  PrivilegedAdminAction,
  ServerAdminAuthorizationOptions,
  VerifiedFirebaseAdminIdentity,
  VerifiedIapPrincipal,
} from './server-authorization';
export { mutateAdminRoles } from './role-mutation';
export type {
  AdminRoleMutationService,
  PrivilegedActionAuthorizer,
  StaffRole,
} from './role-mutation';
export {
  FirebaseSessionAuthorizationError,
  createFirebaseSessionAuthorizer,
  normalizeAdminEmail,
} from './firebase-session-authorizer';
export { resolveAdminAuthMode, type AdminAuthMode } from './mode';
export { authorizeAdminRequest, authErrorResponse, type ResolvedAdminCaller } from './request-auth';
