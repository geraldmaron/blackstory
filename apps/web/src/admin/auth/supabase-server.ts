/**
 * Server-side Supabase session reads for admin pages and middleware.
 *
 * Authorization is decided from the verified user returned by auth.getUser(), which
 * re-validates the token against Supabase — never from the cookie payload alone, which
 * the browser controls. Role comes from app_metadata.bb_role only, matching the API path
 * in supabase-session-authorizer.ts.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { StaffRole } from './role-mutation';
import {
  readSupabaseRoleFromAppMetadata,
  readSupabaseServerConfig,
} from './supabase-session-authorizer';

export type ServerAdminIdentity = {
  readonly uid: string;
  readonly email: string;
  readonly role: StaffRole;
};

/**
 * Read-only Supabase client bound to the request cookies. Server components cannot
 * write cookies, so token refresh is left to middleware; setAll is a no-op here.
 */
async function createAdminServerClient() {
  const { url, anonKey } = readSupabaseServerConfig();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        /* refresh happens in middleware; RSCs may not mutate cookies */
      },
    },
  });
}

/**
 * The verified staff identity for this request, or null when the caller is not signed
 * in or carries no recognized app_metadata.bb_role. A signed-in Supabase user without a
 * staff role is not an administrator and must be treated as anonymous.
 */
export async function readVerifiedAdminIdentity(): Promise<ServerAdminIdentity | null> {
  let client: Awaited<ReturnType<typeof createAdminServerClient>>;
  try {
    client = await createAdminServerClient();
  } catch {
    // Missing Supabase configuration must fail closed, not fail open.
    return null;
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) return null;

  const role = readSupabaseRoleFromAppMetadata(data.user.app_metadata);
  if (!role) return null;

  return { uid: data.user.id, email: data.user.email.trim().toLowerCase(), role };
}
