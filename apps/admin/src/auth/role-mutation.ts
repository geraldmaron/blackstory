/**
 * Provides the only application-facing role mutation flow: layered server authorization,
 * recent reauthentication, then a trusted Firebase Admin custom-claims operation.
 */
import type {
  AdminRequestHeaders,
  AuthorizedAdminRequest,
  PrivilegedAdminAction,
} from './server-authorization';

export type StaffRole = 'admin' | 'research' | 'publication' | 'security';

export type PrivilegedActionAuthorizer = {
  assertPrivilegedAction(
    headers: AdminRequestHeaders,
    action: PrivilegedAdminAction,
  ): Promise<AuthorizedAdminRequest>;
};

export type AdminRoleMutationService = {
  setRoles(
    actor: AuthorizedAdminRequest['admin'],
    targetUid: string,
    roles: readonly StaffRole[],
  ): Promise<void>;
};

export async function mutateAdminRoles(
  headers: AdminRequestHeaders,
  targetUid: string,
  roles: readonly StaffRole[],
  authorizer: PrivilegedActionAuthorizer,
  mutationService: AdminRoleMutationService,
): Promise<void> {
  const identity = await authorizer.assertPrivilegedAction(headers, 'role_change');
  await mutationService.setRoles(identity.admin, targetUid, roles);
}
