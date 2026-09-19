/** Server request headers, permissions, and authentication failures for Supabase admin routes. */
export type AdminRequestHeaders =
  | { get(name: string): string | null }
  | Readonly<Record<string, string | readonly string[] | undefined>>;

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

export class ServerAdminAuthorizationError extends Error {
  readonly code: 'ADMIN_BEARER_TOKEN_REQUIRED';

  constructor(code: ServerAdminAuthorizationError['code'], message: string) {
    super(message);
    this.name = 'ServerAdminAuthorizationError';
    this.code = code;
  }
}

export const AUTHORIZATION_HEADER = 'authorization';
