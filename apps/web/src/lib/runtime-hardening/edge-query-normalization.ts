/**
 * Edge middleware handler that strips unknown query params before SSR/cache.
 * Preserves `_vercel_*` handshake params (see query-normalization) so Vercel
 * Deployment Protection SSO cannot enter a strip↔re-auth redirect loop.
 * Does not 308 solely to re-sort query keys (see needsQueryNormalizationRedirect).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { buildNormalizedUrl, needsQueryNormalizationRedirect } from './query-normalization';

/** Paths where query normalization runs (public HTML routes).  */
export const QUERY_NORMALIZATION_MATCHER = [
  '/',
  '/search',
  '/entity/:path*',
  '/explore',
  '/history',
  '/about',
  '/methodology',
  '/topics',
  '/stories',
  '/corrections',
];

export function handleQueryNormalization(request: NextRequest): NextResponse {
  const url = request.nextUrl;
  if (!needsQueryNormalizationRedirect(url)) {
    return NextResponse.next();
  }
  const normalized = buildNormalizedUrl(url);
  // Absolute string Location — avoids NextURL/searchParams reorder quirks on redirect.
  const response = NextResponse.redirect(normalized.href, 308);
  // Normalization redirects must never be CDN-cached: /search carries s-maxage in
  // next.config headers and a cached 308 to itself causes ERR_TOO_MANY_REDIRECTS.
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
