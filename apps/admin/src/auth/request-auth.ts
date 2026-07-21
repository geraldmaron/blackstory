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

function supabaseVerifierFromEnv(environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const { url, anonKey } = readSupabaseServerConfig(environment);
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { async getUser(accessToken: string) { return client.auth.getUser(accessToken); } };
}

export async function authorizeAdminRequest(headers: AdminRequestHeaders): Promise<ResolvedAdminCaller> {
  const identity = await createSupabaseSessionAuthorizer(supabaseVerifierFromEnv()).assertAuthenticated(headers);
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
  console.error('admin auth failure', error);
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
