/** Server request authorization through verified Supabase Auth JWTs. */
import { createClient } from '@supabase/supabase-js';
import type { StaffRole } from './role-mutation';
import { ServerAdminAuthorizationError, type AdminRequestHeaders } from './server-authorization';
import {
  SupabaseSessionAuthorizationError,
  createSupabaseSessionAuthorizer,
  readSupabaseServerConfig,
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

export async function authorizeAdminRequest(
  headers: AdminRequestHeaders,
): Promise<ResolvedAdminCaller> {
  const identity =
    await createSupabaseSessionAuthorizer(supabaseVerifierFromEnv()).assertAuthenticated(headers);
  return {
    mode: 'supabase',
    email: identity.email,
    uid: identity.admin.uid,
    role: identity.role,
    admin: identity.admin,
  };
}

export function authErrorResponse(error: unknown): Response {
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
