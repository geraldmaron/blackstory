/**
 * Which request paths under `/admin` the edge auth gate covers.
 *
 * The exclusions live here as plain logic rather than in the middleware `matcher` regex:
 * Next 16 did not honor a negative-lookahead matcher, which silently sent /login through
 * the gate and produced a redirect loop back to itself. The middleware's own `matcher` already
 * scopes it to `/admin/:path*`, so nothing outside `/admin` ever reaches this function in
 * practice — it stays self-contained anyway, on the same "don't trust the matcher alone" lesson.
 */

/** Bearer-token authenticated (see request-auth.ts); a cookie gate would break them. */
const API_PREFIX = '/admin/api/';

/** Reaching sign-in must never require being signed in. */
const SIGN_IN_PATH = '/admin/login';

const PUBLIC_PREFIXES = ['/_next/static/', '/_next/image', '/brand/'];

const PUBLIC_FILES = ['/favicon.ico', '/robots.txt'];

const STATIC_ASSET = /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map|txt)$/i;

export function isAuthGatedPath(pathname: string): boolean {
  if (pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`)) return false;
  if (pathname.startsWith(API_PREFIX)) return false;
  if (PUBLIC_FILES.includes(pathname)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (STATIC_ASSET.test(pathname)) return false;
  // Unknown paths are gated. A new surface is protected before anyone remembers to add it.
  return true;
}
