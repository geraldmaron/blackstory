/**
 * Staff authorization gate composed by `apps/web/src/proxy.ts` for `/admin` pages.
 * The proxy owns route selection; this helper owns staff-session verification and refresh.
 *
 * This runs before any server component renders, so an unauthenticated request never
 * reaches page code and never triggers the Postgres reads those pages perform. It also
 * refreshes the Supabase session cookies, which server components cannot do themselves.
 *
 * /admin/api/* is deliberately excluded: those routes authenticate with an Authorization bearer
 * token (see auth/request-auth.ts) rather than cookies, and already verify app_role per
 * request. Gating them here on a cookie would break non-browser callers.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthGatedPath } from './auth/protected-paths';
import { readSupabaseRoleFromAppMetadata } from './auth/supabase-session-authorizer';

const SIGN_IN_PATH = '/admin/login';

function signInRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = SIGN_IN_PATH;
  url.search = '';
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target && target !== SIGN_IN_PATH) {
    url.searchParams.set('next', target);
  }
  return NextResponse.redirect(url);
}

export async function adminAuthGate(request: NextRequest): Promise<NextResponse> {
  if (!isAuthGatedPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  // Fail closed. A misconfigured deployment must not serve the console unauthenticated.
  if (!url?.trim() || !anonKey?.trim()) {
    return signInRedirect(request);
  }

  // Carries forward any refreshed auth cookies Supabase sets during getUser().
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url.trim(), anonKey.trim(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return signInRedirect(request);
  }

  // A signed-in Supabase user is not an administrator. Staff role is the actual gate.
  if (!readSupabaseRoleFromAppMetadata(data.user.app_metadata)) {
    return signInRedirect(request);
  }

  return response;
}
