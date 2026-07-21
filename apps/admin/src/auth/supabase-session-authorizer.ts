/**
 * Supabase session authorizer for admin API access.
 * Verifies a Supabase access token via auth.getUser(jwt), requires email, and reads
 * staff role exclusively from app_metadata.bb_role (never user_metadata).
 */
import type { StaffRole } from './role-mutation';
import {
  AUTHORIZATION_HEADER,
  ServerAdminAuthorizationError,
  type AdminRequestHeaders,
} from './server-authorization';

function normalizeAdminEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type VerifiedSupabaseAdminIdentity = {
  readonly uid: string;
  readonly email: string;
  readonly bb_role: StaffRole;
  readonly app_metadata: {
    readonly bb_role: StaffRole;
  };
};

export type SupabaseAuthUserRecord = {
  readonly id: string;
  readonly email?: string;
  readonly app_metadata?: Readonly<Record<string, unknown>>;
};

export type SupabaseUserVerifier = {
  getUser(accessToken: string): Promise<{
    readonly data: { readonly user: SupabaseAuthUserRecord | null };
    readonly error: { readonly message: string } | null;
  }>;
};

export type SupabaseSessionAuthorizedAdmin = {
  readonly admin: VerifiedSupabaseAdminIdentity;
  readonly email: string;
  readonly role: StaffRole;
};

const STAFF_ROLES: readonly StaffRole[] = ['admin', 'research', 'publication', 'security'];

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

function readHeader(headers: AdminRequestHeaders, name: string): string | undefined {
  if ('get' in headers && typeof headers.get === 'function') {
    return headers.get(name)?.trim() || undefined;
  }
  const values = headers as Readonly<Record<string, string | readonly string[] | undefined>>;
  const value = Object.entries(values).find(([candidate]) => candidate.toLowerCase() === name)?.[1];
  const first = typeof value === 'string' ? value : value?.[0];
  return first?.trim() || undefined;
}

function requireBearerAccessToken(headers: AdminRequestHeaders): string {
  const authorization = readHeader(headers, AUTHORIZATION_HEADER);
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
  if (!match?.[1]) {
    throw new ServerAdminAuthorizationError(
      'ADMIN_BEARER_TOKEN_REQUIRED',
      'A Supabase bearer access token is required',
    );
  }
  return match[1];
}

export class SupabaseSessionAuthorizationError extends Error {
  readonly code:
    | 'ADMIN_EMAIL_REQUIRED'
    | 'ADMIN_SESSION_INVALID'
    | 'ADMIN_ROLE_REQUIRED'
    | 'ADMIN_ROLE_UNKNOWN';

  constructor(code: SupabaseSessionAuthorizationError['code'], message: string) {
    super(message);
    this.name = 'SupabaseSessionAuthorizationError';
    this.code = code;
  }
}

export function readSupabaseRoleFromAppMetadata(
  appMetadata: Readonly<Record<string, unknown>> | null | undefined,
): StaffRole | undefined {
  const role = appMetadata?.bb_role;
  return isStaffRole(role) ? role : undefined;
}

export function createSupabaseSessionAuthorizer(verifier: SupabaseUserVerifier) {
  return {
    async assertAuthenticated(
      headers: AdminRequestHeaders,
    ): Promise<SupabaseSessionAuthorizedAdmin> {
      const accessToken = requireBearerAccessToken(headers);
      const { data, error } = await verifier.getUser(accessToken);

      if (error || !data.user) {
        throw new SupabaseSessionAuthorizationError(
          'ADMIN_SESSION_INVALID',
          error?.message ?? 'Supabase access token is invalid or expired',
        );
      }

      const email = data.user.email;
      if (!email) {
        throw new SupabaseSessionAuthorizationError(
          'ADMIN_EMAIL_REQUIRED',
          'Supabase administrator identity must include an email',
        );
      }

      const bbRole = readSupabaseRoleFromAppMetadata(data.user.app_metadata);
      if (!bbRole) {
        const rawRole = data.user.app_metadata?.bb_role;
        throw new SupabaseSessionAuthorizationError(
          rawRole === undefined || rawRole === null || rawRole === ''
            ? 'ADMIN_ROLE_REQUIRED'
            : 'ADMIN_ROLE_UNKNOWN',
          rawRole === undefined || rawRole === null || rawRole === ''
            ? 'Supabase administrator must have app_metadata.bb_role set'
            : 'Supabase administrator has an unknown app_metadata.bb_role',
        );
      }

      const normalizedEmail = normalizeAdminEmail(email);
      return {
        admin: {
          uid: data.user.id,
          email: normalizedEmail,
          bb_role: bbRole,
          app_metadata: { bb_role: bbRole },
        },
        email: normalizedEmail,
        role: bbRole,
      };
    },
  };
}

export function readSupabaseServerConfig(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { readonly url: string; readonly anonKey: string } {
  const url = environment.SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = environment.SUPABASE_ANON_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    throw new ServerAdminAuthorizationError(
      'ADMIN_BEARER_TOKEN_REQUIRED',
      'Supabase auth mode requires SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents)',
    );
  }
  return { url: url.trim(), anonKey: anonKey.trim() };
}
