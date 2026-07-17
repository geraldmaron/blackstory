/**
 * Exposes server-side administrator authorization and role-mutation composition helpers.
 */
export {
  AUTHORIZATION_HEADER,
  IAP_ASSERTION_HEADER,
  ServerAdminAuthorizationError,
  createServerAdminAuthorizer,
} from './server-authorization.js';
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
} from './server-authorization.js';
export { mutateAdminRoles } from './role-mutation.js';
export type {
  AdminRoleMutationService,
  PrivilegedActionAuthorizer,
  StaffRole,
} from './role-mutation.js';
