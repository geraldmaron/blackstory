/**
 * Server request authorization through verified Supabase Auth JWTs.
 *
 * Two steps, and a route needs both: `authorizeAdminRequest` establishes who the caller is,
 * and `authorizeAdminRoute` then checks that the caller's staff role holds the authority the
 * route declares in `route-permissions.ts`. Authentication alone lets any staff account call
 * any route, so routes call `authorizeAdminRoute`.
 */
import { createClient } from '@supabase/supabase-js';
import type { StaffRole } from './role-mutation';
import { AdminRouteUndeclaredError, STAFF_READ, findAdminRouteAccess } from './route-permissions';
import { ServerAdminAuthorizationError, type AdminRequestHeaders } from './server-authorization';
import { StaffPermissionDeniedError, assertStaffPermission } from './staff-permissions';
import {
  SupabaseSessionAuthorizationError,
  createSupabaseSessionAuthorizer,
  readSupabaseServerConfig,
  type SupabaseUserVerifier,
  type VerifiedSupabaseAdminIdentity,
} from './supabase-session-authorizer';

export type ResolvedAdminCaller = {
  readonly mode: 'supabase';
  readonly email: string;
  readonly uid: string;
  readonly role: StaffRole;
  readonly admin: VerifiedSupabaseAdminIdentity;
};

function supabaseVerifierFromEnv(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const { url, anonKey } = readSupabaseServerConfig(environment);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async getUser(accessToken: string) {
      return client.auth.getUser(accessToken);
    },
  };
}

/** One line, bounded length: log records must not be forgeable by their own subject. */
function sanitizeForLog(value: unknown): string {
  const text = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ').slice(0, 500);
}

/**
 * Authenticate, then enforce the route's declared authority.
 *
 * Takes the whole request rather than its headers: the method and path are what select the rule,
 * and a caller that cannot supply them cannot be authorized. A path the table does not cover is
 * denied, so a route added without a rule is closed rather than open.
 */
export function createAdminRouteAuthorizer(verifier: SupabaseUserVerifier) {
  const sessions = createSupabaseSessionAuthorizer(verifier);
  return {
    async authorize(request: Request): Promise<ResolvedAdminCaller> {
      const caller = callerFrom(await sessions.assertAuthenticated(request.headers));
      const { pathname } = new URL(request.url);
      const access = findAdminRouteAccess(request.method, pathname);
      if (!access) {
        throw new AdminRouteUndeclaredError(request.method, pathname);
      }
      if (access !== STAFF_READ) {
        assertStaffPermission(caller.role, access);
      }
      return caller;
    },
  };
}

function callerFrom(identity: {
  readonly email: string;
  readonly role: StaffRole;
  readonly admin: VerifiedSupabaseAdminIdentity;
}): ResolvedAdminCaller {
  return {
    mode: 'supabase',
    email: identity.email,
    uid: identity.admin.uid,
    role: identity.role,
    admin: identity.admin,
  };
}

/** Authentication only. Use `authorizeAdminRoute` from a route: this grants no authority check. */
export async function authorizeAdminRequest(
  headers: AdminRequestHeaders,
): Promise<ResolvedAdminCaller> {
  return callerFrom(
    await createSupabaseSessionAuthorizer(supabaseVerifierFromEnv()).assertAuthenticated(headers),
  );
}

export async function authorizeAdminRoute(request: Request): Promise<ResolvedAdminCaller> {
  return createAdminRouteAuthorizer(supabaseVerifierFromEnv()).authorize(request);
}

/**
 * Whether an error came from the auth gate rather than from the route's own work. Routes that
 * map their domain errors to 400 or 404 ask this first, so a 403 is not relabeled on the way out.
 */
export function isAdminAuthorizationError(error: unknown): boolean {
  return (
    error instanceof SupabaseSessionAuthorizationError ||
    error instanceof ServerAdminAuthorizationError ||
    error instanceof StaffPermissionDeniedError ||
    error instanceof AdminRouteUndeclaredError
  );
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof StaffPermissionDeniedError) {
    return Response.json(
      {
        error: `Your role (${error.role}) cannot perform this action. It requires ${error.permission}.`,
        code: 'ADMIN_PERMISSION_DENIED',
      },
      { status: 403 },
    );
  }
  if (error instanceof AdminRouteUndeclaredError) {
    // The path is logged, not returned: what the table does or does not cover is not something a
    // caller needs told back.
    console.error(
      'admin route has no declared permission',
      sanitizeForLog(`${error.method} ${error.pathname}`),
    );
    return Response.json(
      {
        error: 'This admin route declares no permission and is closed.',
        code: 'ADMIN_ROUTE_UNDECLARED',
      },
      { status: 403 },
    );
  }
  if (error instanceof SupabaseSessionAuthorizationError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.code === 'ADMIN_SESSION_INVALID' ? 401 : 403 },
    );
  }
  if (error instanceof ServerAdminAuthorizationError) {
    return Response.json({ error: error.message, code: error.code }, { status: 401 });
  }
  // Newlines stripped, length capped. An auth failure can carry a value the caller supplied
  // (a header, a token fragment), and logging it verbatim lets that value forge extra log lines
  // that read as though the server wrote them (CodeQL js/log-injection).
  console.error('admin auth failure', sanitizeForLog(error));
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
