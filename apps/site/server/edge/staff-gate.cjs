/**
 * Staff gate for /admin and /design-system. Port of apps/web/src/admin/admin-auth-gate.ts and
 * admin/auth/protected-paths.ts. Verifies the Supabase session cookie and requires an
 * `app_metadata.app_role` that is a known staff role; anything else is redirected to sign-in.
 *
 * The Supabase client is injected so tests need no network. Cookie refreshes Supabase asks for are
 * returned as Set-Cookie values for the caller to attach to the final response.
 */
const { parseCookieHeader, serializeSetCookie } = require('./cookies.cjs');

const API_PREFIX = '/admin/api/';
const SIGN_IN_PATH = '/admin/login';
const PUBLIC_PREFIXES = ['/_expo/static/', '/brand/'];
const PUBLIC_FILES = ['/favicon.ico', '/robots.txt'];
const STATIC_ASSET = /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map|txt)$/i;
const STAFF_ROLES = ['admin', 'research', 'publication', 'security'];

/** Which paths under the gate actually need a session (sign-in page, bearer-token API and static files do not). */
function isAuthGatedPath(rawPathname) {
  const pathname = rawPathname.toLowerCase();
  if (pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`)) return false;
  if (pathname.startsWith(API_PREFIX)) return false;
  if (PUBLIC_FILES.includes(pathname)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (
    !pathname.startsWith('/admin/') &&
    !pathname.startsWith('/design-system/') &&
    STATIC_ASSET.test(pathname)
  )
    return false;
  return true;
}

function isStaffGatePath(rawPathname) {
  // Case-insensitive on purpose: the router's case rules are not ours to guess, so over-protect.
  const pathname = rawPathname.toLowerCase();
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/design-system' ||
    pathname.startsWith('/design-system/')
  );
}

function readStaffRole(appMetadata) {
  const role = appMetadata?.app_role;
  return typeof role === 'string' && STAFF_ROLES.includes(role) ? role : undefined;
}

function signInRedirect({ pathname, search }) {
  const target = `${pathname}${search}`;
  const params = new URLSearchParams();
  if (target && target !== SIGN_IN_PATH) params.set('next', target);
  const query = params.toString();
  return {
    status: 307,
    headers: {
      location: `${SIGN_IN_PATH}${query ? `?${query}` : ''}`,
      'cache-control': 'private, no-store',
    },
  };
}

function defaultCreateClient(url, anonKey, options) {
  // Lazy so the server starts (and tests run) without @supabase/ssr being loaded.
  return require('@supabase/ssr').createServerClient(url, anonKey, options);
}

/**
 * @param {{pathname:string, search:string, headers:Record<string,string>}} request
 * @returns {Promise<{pass:true, setCookies:string[]} | {pass:false, response:{status:number, headers:Record<string,string>}}>}
 */
async function staffGate(request, { env = process.env, createClient = defaultCreateClient } = {}) {
  if (!isAuthGatedPath(request.pathname)) return { pass: true, setCookies: [] };

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) return { pass: false, response: signInRedirect(request) };

  const setCookies = [];
  const cookies = parseCookieHeader(request.headers.cookie);
  const supabase = createClient(url.trim(), anonKey.trim(), {
    cookies: {
      getAll: () => cookies,
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet)
          setCookies.push(serializeSetCookie(name, value, options ?? {}));
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.email) return { pass: false, response: signInRedirect(request) };
  if (!readStaffRole(data.user.app_metadata))
    return { pass: false, response: signInRedirect(request) };
  return { pass: true, setCookies };
}

module.exports = { isAuthGatedPath, isStaffGatePath, readStaffRole, staffGate, STAFF_ROLES };
