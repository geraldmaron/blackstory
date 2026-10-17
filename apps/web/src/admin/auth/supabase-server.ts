/**
 * Server-side Supabase session reads for admin pages and middleware.
 *
 * Authorization is decided from a verified token, never from the cookie payload alone, which
 * the browser controls. The proxy validates the session against Supabase (`getUser`); this module
 * re-verifies the signed token locally (`getClaims`). Role comes from app_metadata.app_role only, matching the API path
 * in supabase-session-authorizer.ts.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { StaffRole } from './staff-permissions';
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
 * in or carries no recognized app_metadata.app_role. A signed-in Supabase user without a
 * staff role is not an administrator and must be treated as anonymous.
 *
 * This is the second layer behind the proxy, which already called `auth.getUser()` (a Supabase
 * round trip that also catches a revoked session) moments earlier for the same request. So this
 * layer verifies the token's signature, issuer and expiry locally with `auth.getClaims()` against
 * the project's cached signing keys: it still stops a matcher mistake or a forged cookie, and it
 * costs no network. Before this, each navigation paid one Supabase round trip per layout and page
 * that asked (two or three), measured at 150 to 250 ms apiece.
 *
 * `cache()` makes the layout and the page that both ask share one verification per request.
 */
export const readVerifiedAdminIdentity = cache(async (): Promise<ServerAdminIdentity | null> => {
  let client: Awaited<ReturnType<typeof createAdminServerClient>>;
  try {
    client = await createAdminServerClient();
  } catch {
    // Missing Supabase configuration must fail closed, not fail open.
    return null;
  }

  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.email !== 'string' || !claims.email) return null;

  const role = readSupabaseRoleFromAppMetadata(
    claims.app_metadata as Readonly<Record<string, unknown>> | undefined,
  );
  if (!role || typeof claims.sub !== 'string') return null;

  return { uid: claims.sub, email: claims.email.trim().toLowerCase(), role };
});
