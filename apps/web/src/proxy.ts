/**
 * Edge web security composed with query normalization, behind the maintenance wall.
 *
 * Was `middleware.ts`. Next 16 deprecated that file convention in favour of `proxy`; the rename is
 * the whole migration — same request object, same `config.matcher` semantics, same edge runtime.
 * Only the file name and the exported function name changed.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { handleMaintenance } from './lib/maintenance/maintenance-gate';
import { denyExpensiveAiCrawler } from './lib/traffic-class/edge-deny';
import { handleWebSecurity } from './lib/web-security/edge-security';
import { STAND_COOKIE, isPublicPlaceSlug } from './lib/place/public-place-path';

function standSlugFromRequest(request: NextRequest): string | undefined {
  const at = request.nextUrl.searchParams.get('at');
  if (at && isPublicPlaceSlug(at)) return at;
  if (request.nextUrl.pathname.startsWith('/place/')) {
    const slug = request.nextUrl.pathname.slice('/place/'.length).split('/')[0] ?? '';
    if (isPublicPlaceSlug(slug)) return slug;
  }
  return undefined;
}

function attachStandCookie(request: NextRequest, response: NextResponse): NextResponse {
  const slug = standSlugFromRequest(request);
  if (!slug) return response;
  response.cookies.set(STAND_COOKIE, slug, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    httpOnly: true,
  });
  return response;
}

export function proxy(request: NextRequest) {
  // First, always. A walled request must not reach a route, a React render, or `bb_public`.
  const maintenanceResponse = handleMaintenance(request);
  if (maintenanceResponse !== null) {
    return maintenanceResponse;
  }

  const aiDeny = denyExpensiveAiCrawler(request);
  if (aiDeny !== null) {
    return aiDeny;
  }

  // Outside the security/normalization surface this is a bare pass-through, which is what these
  // paths got before the matcher was widened for maintenance mode. See `config` below.
  const response = isSecurityNormalizedPath(request.nextUrl.pathname)
    ? handleWebSecurity(request)
    : NextResponse.next();

  return attachStandCookie(request, response);
}

/**
 * The real security/normalization surface: public HTML routes only.
 *
 * This predicate is the former `config.matcher` list, moved from build-time routing to a runtime
 * check. The matcher itself had to widen to everything so maintenance mode can answer any path
 * at the edge, and a matcher cannot be computed from `process.env` — Next requires it to be
 * statically analyzable. Rather than let the wider matcher quietly extend query normalization
 * over endpoints that must never see it, the old list is enforced here instead, unchanged.
 *
 * Endpoints must never appear here: an endpoint's contract *is* its query string, and
 * normalization 308s it away before the handler ever parses it. `/history/api` and `/submit/api`
 * were the two that had slipped in, both with an empty allowlist, so both were answering a
 * stripped request. Every other endpoint (`/explore/api`, `/search/api`, `/locate/api`, the
 * `/corrections/*` handlers) is already out and stays out.
 *
 * `/history` is out for exactly that reason: it renders nothing and exists only to map `decade`
 * onto `era` and resolve to `/records`. Matched, its parse→build normalization rewrote the
 * reader's own params first — a bare `decade=1930` failed the `\d{4}s` parse and was dropped
 * outright — so the fold cost two hops and lost the decade on the way. `/search` stays matched:
 * it carries a free-text `q` that has to be sanitised before it is echoed anywhere.
 *
 * `/explore` is the Atlas instrument (not a redirect to `/`). It keeps its facet allowlist.
 * `/` is the Door and has an empty allowlist, so leftover Atlas params 308 away instead of
 * fragmenting the Cloudflare HTML cache. `/atlas/catalog` and `/sitemap.xml` take no query:
 * cache-busting `?x=` 308s to the bare path. Search/refine/geocode APIs stay out so their
 * contracts are not stripped.
 */
const SECURITY_NORMALIZED_EXACT = new Set([
  '/',
  '/search',
  '/explore',
  '/atlas/catalog',
  '/sitemap.xml',
  '/law',
  '/legal',
  '/errata',
  '/about',
  '/methodology',
  '/stories',
  '/corrections',
  '/submit',
]);

/** Prefix forms of the `:path*` segments in the original matcher. */
const SECURITY_NORMALIZED_PREFIXES = [
  '/place/',
  '/entity/',
  '/law/',
  '/legal/',
  '/errata/',
  '/stories/',
] as const;

export function isSecurityNormalizedPath(pathname: string): boolean {
  if (SECURITY_NORMALIZED_EXACT.has(pathname)) {
    return true;
  }
  return SECURITY_NORMALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Everything except build output and brand art.
 *
 * Wide because maintenance mode has to be able to answer *any* path — including `/robots.txt`
 * and `/sitemap.xml`, whose site-wide 503 is the signal that tells crawlers to back off instead
 * of reindexing the archive as a maintenance notice. The exclusions mirror
 * `ALWAYS_ALLOWED_PREFIXES` in `maintenance-policy.ts`: static build output and `/brand` stay
 * reachable so a bypassed operator gets a working site and the maintenance page can render its
 * lockup.
 *
 * With the wall down, the extra paths this now matches cost one `NextResponse.next()` each; on
 * Vercel they were already counted as edge requests before the proxy ran.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|brand/|favicon.ico).*)'],
};
