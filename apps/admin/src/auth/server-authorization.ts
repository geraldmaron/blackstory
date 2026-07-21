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

export type IapAssertionVerifier = {
  verifyAssertion(assertion: string): Promise<VerifiedIapPrincipal>;
};

export type AdminTokenVerifier = {
  verifyIdToken(idToken: string, checkRevoked: true): Promise<VerifiedAdminIdentity>;
};

export type AdminAuthorizationPolicy = {
  assertAdminIdentity(token: VerifiedAdminIdentity): void;
  assertAdminPermission(token: VerifiedAdminIdentity, permission: AdminPermission): void;
  assertRecentReauth(token: VerifiedAdminIdentity, action: PrivilegedAdminAction): void;
};

export type ServerAdminAuthorizationOptions = {
  readonly expectedIapEmailDomain?: string;
};

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

export const IAP_ASSERTION_HEADER = 'x-goog-iap-jwt-assertion';
export const AUTHORIZATION_HEADER = 'authorization';

function readHeader(headers: AdminRequestHeaders, name: string): string | undefined {
  if ('get' in headers && typeof headers.get === 'function') {
    return headers.get(name)?.trim() || undefined;
  }
  const values = headers as Readonly<Record<string, string | readonly string[] | undefined>>;
  const value = Object.entries(values).find(([candidate]) => candidate.toLowerCase() === name)?.[1];
  const first = typeof value === 'string' ? value : value?.[0];
  return first?.trim() || undefined;
}

function requireIapAssertion(headers: AdminRequestHeaders): string {
  const assertion = readHeader(headers, IAP_ASSERTION_HEADER);
  if (!assertion) {
    throw new ServerAdminAuthorizationError(
      'IAP_ASSERTION_REQUIRED',
      'A verified IAP assertion is required',
    );
  }
  return assertion;
}

function requireAdminBearerToken(headers: AdminRequestHeaders): string {
  const authorization = readHeader(headers, AUTHORIZATION_HEADER);
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
  if (!match?.[1]) {
    throw new ServerAdminAuthorizationError(
      'ADMIN_BEARER_TOKEN_REQUIRED',
      'An administrator bearer token is required',
    );
  }
  return match[1];
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertLayeredIdentity(
  iap: VerifiedIapPrincipal,
  admin: VerifiedAdminIdentity,
  options: ServerAdminAuthorizationOptions,
): void {
  if (!admin.email || normalizedEmail(iap.email) !== normalizedEmail(admin.email)) {
    throw new ServerAdminAuthorizationError(
      'ADMIN_IDENTITY_MISMATCH',
      'Edge and administrator identities must match',
    );
  }
  if (options.expectedIapEmailDomain) {
    const domain = normalizedEmail(iap.email).split('@')[1];
    if (domain !== options.expectedIapEmailDomain.toLowerCase()) {
      throw new ServerAdminAuthorizationError(
        'IAP_DOMAIN_DENIED',
        'IAP principal is outside the allowed administrator domain',
      );
    }
  }
}

export function createServerAdminAuthorizer(
  iapVerifier: IapAssertionVerifier,
  tokenVerifier: AdminTokenVerifier,
  policy: AdminAuthorizationPolicy,
  options: ServerAdminAuthorizationOptions = {},
) {
  async function verifyLayers(headers: AdminRequestHeaders): Promise<AuthorizedAdminRequest> {
    const iapAssertion = requireIapAssertion(headers);
    const adminToken = requireAdminBearerToken(headers);
    const [iap, admin] = await Promise.all([
      iapVerifier.verifyAssertion(iapAssertion),
      tokenVerifier.verifyIdToken(adminToken, true),
    ]);
    assertLayeredIdentity(iap, admin, options);
    return { iap, admin };
  }

  return {
    async assertAuthenticated(headers: AdminRequestHeaders): Promise<AuthorizedAdminRequest> {
      const identity = await verifyLayers(headers);
      policy.assertAdminIdentity(identity.admin);
      return identity;
    },

    async assertPermission(
      headers: AdminRequestHeaders,
      permission: AdminPermission,
    ): Promise<AuthorizedAdminRequest> {
      const identity = await verifyLayers(headers);
      policy.assertAdminPermission(identity.admin, permission);
      return identity;
    },

    async assertPrivilegedAction(
      headers: AdminRequestHeaders,
      action: PrivilegedAdminAction,
    ): Promise<AuthorizedAdminRequest> {
      const identity = await verifyLayers(headers);
      policy.assertRecentReauth(identity.admin, action);
      return identity;
    },
  };
}
