/**
 * Composes verified edge and bearer-token identities into server-side administrator authorization.
 * Browser route state is intentionally absent from this module and cannot grant access.
 */
export type AdminRequestHeaders =
  | { get(name: string): string | null }
  | Readonly<Record<string, string | readonly string[] | undefined>>;

export type VerifiedIapPrincipal = {
  readonly subject: string;
  readonly email: string;
};

export type VerifiedAdminIdentity = {
  readonly uid: string;
  readonly email?: string;
  readonly auth_time: number;
  readonly admin?: boolean;
  readonly research?: boolean;
  readonly publication?: boolean;
  readonly security?: boolean;
  readonly bb_role?: 'admin' | 'research' | 'publication' | 'security';
  readonly bb_roles?: readonly unknown[];
  readonly amr?: readonly string[];
  readonly [claim: string]: unknown;
};

export type AdminPermission =
  | 'research:write'
  | 'canonical:write'
  | 'canonical:merge'
  | 'canonical:bulk_write'
  | 'publication:publish'
  | 'publication:retract'
  | 'rights:change'
  | 'policy:change'
  | 'export:privileged'
  | 'roles:change';

export type PrivilegedAdminAction =
  | 'publication'
  | 'retraction'
  | 'rights_change'
  | 'policy_change'
  | 'privileged_export'
  | 'role_change';

export type AuthorizedAdminRequest = {
  readonly iap: VerifiedIapPrincipal;
  readonly admin: VerifiedAdminIdentity;
};

export class ServerAdminAuthorizationError extends Error {
  readonly code:
    | 'IAP_ASSERTION_REQUIRED'
    | 'ADMIN_BEARER_TOKEN_REQUIRED'
    | 'ADMIN_IDENTITY_MISMATCH'
    | 'IAP_DOMAIN_DENIED';

  constructor(code: ServerAdminAuthorizationError['code'], message: string) {
    super(message);
    this.name = 'ServerAdminAuthorizationError';
    this.code = code;
  }
}

export const AUTHORIZATION_HEADER = 'authorization';
