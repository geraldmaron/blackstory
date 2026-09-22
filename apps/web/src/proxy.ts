/**
 * Composes maintenance controls, query normalization, staff authentication and response
 * security headers. Next.js uses one proxy entry point. A fresh nonce is forwarded through
 * x-nonce and applied consistently to every response branch; the theme bootstrap uses its
 * explicit content hash.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminAuthGate } from './admin/admin-auth-gate';
import { handleMaintenance } from './lib/maintenance/maintenance-gate';
import { denyExpensiveAiCrawler } from './lib/traffic-class/edge-deny';
import { handleWebSecurity } from './lib/web-security/edge-security';
import { CSP_NONCE_HEADER } from './lib/web-security/constants';
import { buildGlobalSecurityHeaders } from './lib/web-security/security-headers';
import { surfaceClassFor } from './lib/nav/surface-classes';

/** Base64 per-request nonce for CSP `script-src 'nonce-<value>'`. Edge-runtime safe: both
 * `crypto` (Web Crypto, global) and `Buffer` (Next's edge polyfill) are available here. */
function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

/**
 * Public documents are the same for every visitor, so Vercel's CDN may keep them. This is the
 * header that says so, sent from here because a request-rendered page cannot: Next stamps
 * `private, no-cache, no-store` on every dynamic render and that is what `Cache-Control` from
 * next.config.mjs loses to (measured 2026-08-09). `Vercel-CDN-Cache-Control` is consumed by
 * Vercel alone, outranks `Cache-Control` in its cache, and is never forwarded, so the browser
 * and Cloudflare still see the page's own policy.
 *
 * Nonce safety: the CDN stores header and body together, so a cached document carries the CSP
 * whose nonce is in its own script tags. The same argument already holds for `/` at Cloudflare.
 *
 * Five minutes fresh, one hour stale-while-revalidate: an in-place correction reaches readers
 * within about five minutes without any purge, and a burst never lines up behind one render.
 *
 * RSC payloads are cached too, on purpose. Next strips `rsc` and the router headers from the
 * request before this proxy runs (verified against the dev server: an `rsc: 1` request is not
 * distinguishable here), but the page's own `Vary: rsc, next-router-state-tree, ...` makes
 * Vercel key the entry on those request headers, so an RSC navigation and the HTML document
 * never share an entry and a navigation back to `/` is served from the edge instead of a
 * 2.5 MB render. Cloudflare cannot vary on headers on the Free plan, which is why its rules
 * exclude `rsc` requests; this layer does not need to.
 *
 * Whether Vercel honors this on a dynamic page whose `Cache-Control` says `no-store` is a
 * documented precedence, not yet an observed one: after deploy, the second request for an entity
 * page must answer `x-vercel-cache: HIT` (`repo-ogo3j.3`). If it does not, this header costs
 * nothing.
 */
export const PUBLIC_DOCUMENT_CDN_CACHE_CONTROL =
  'public, s-maxage=300, stale-while-revalidate=3600';

/**
 * A response the CDN may keep: a GET or HEAD for a rendered public surface (per the surface
 * registry, which already excludes endpoints and everything under `/admin`), and never a
 * correction receipt, whose URL is the only thing protecting it.
 */
export function isPublicDocumentCacheable(request: NextRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/corrections/status')) return false;
  return surfaceClassFor(pathname) !== null;
}

function applyPublicDocumentCdnCache(request: NextRequest, response: NextResponse): NextResponse {
  // A maintenance 503 or a crawler 403 decided here is not a document. Vercel would not keep
  // either status anyway; this just keeps the header off responses that were never candidates.
  if (response.status >= 400) return response;
  if (!isPublicDocumentCacheable(request)) return response;
  response.headers.set('Vercel-CDN-Cache-Control', PUBLIC_DOCUMENT_CDN_CACHE_CONTROL);
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Issued once per request, before any branch below, so every one of them — including early
  // returns (maintenance wall, AI-crawler deny, admin sign-in redirect) — can carry it forward.
  // Mutating the live `request.headers` (rather than a copy) means every downstream helper that
  // re-reads `request` for its own `NextResponse.next({ request })` — `adminAuthGate` already
  // does this for Supabase cookie refresh — picks the nonce up for free.
  const nonce = generateNonce();
  const authUrl =
    request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : undefined;
  const securityHeaders = buildGlobalSecurityHeaders({ nonce, ...(authUrl ? { authUrl } : {}) });
  const contentSecurityPolicy = securityHeaders.find(
    ({ key }) => key === 'Content-Security-Policy',
  )?.value;
  if (!contentSecurityPolicy) {
    throw new Error('Global security headers must include Content-Security-Policy');
  }
  request.headers.set(CSP_NONCE_HEADER, nonce);
  // Next parses the request CSP before rendering and copies its nonce onto framework scripts.
  // x-nonce remains available to Server Components that render manual scripts.
  request.headers.set('Content-Security-Policy', contentSecurityPolicy);

  const response = await resolveProxyResponse(request);
  // Applied last and unconditionally so CSP (with this request's nonce) reaches every response
  // this proxy returns, not only the narrower `isSecurityNormalizedPath` set below. Any CSP a
  // branch already set (maintenance-gate.ts, edge-security.ts both call `applySecurityHeaders`
  // without a nonce) is overwritten here with the nonce-bearing value — `Headers.set` replaces,
  // it does not append.
  for (const { key, value } of securityHeaders) {
    response.headers.set(key, value);
  }
  return applyPublicDocumentCdnCache(request, response);
}

async function resolveProxyResponse(request: NextRequest): Promise<NextResponse> {
  // First, always. A walled request must not reach a route, a React render, or `published` —
  // and that includes `/admin`: a maintenance window is not staff-exempt by default. Staff use
  // the same MAINTENANCE_BYPASS_TOKEN cookie redemption as anyone let through on purpose.
  const maintenanceResponse = handleMaintenance(request);
  if (maintenanceResponse !== null) {
    return maintenanceResponse;
  }

  const aiDeny = denyExpensiveAiCrawler(request);
  if (aiDeny !== null) {
    return aiDeny;
  }

  // `/admin` is a staff-gated console, not a public page: it gets the Supabase-session check
  // instead of query normalization, and returns here rather than falling through. `adminAuthGate` makes its own pass-through decision for `/admin/login` and
  // `/admin/api/**` (bearer-token auth) via `isAuthGatedPath`.
  if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')) {
    return adminAuthGate(request);
  }

  // Outside the security/normalization surface this is a bare pass-through, which is what these
  // paths got before the matcher was widened for maintenance mode. See `config` below.
  // `{ request }` (rather than a bare `NextResponse.next()`) forwards the nonce header set
  // above into the request the app renders from.
  return isSecurityNormalizedPath(request.nextUrl.pathname)
    ? handleWebSecurity(request)
    : NextResponse.next({ request });
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
 * `/explore` is the Explore instrument (not a redirect to `/`). It keeps its facet allowlist.
 * `/` is the Door and has an empty allowlist, so leftover Explore params 308 away instead of
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
