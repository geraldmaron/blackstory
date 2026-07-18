/**
 * Edge middleware handler that strips unknown query params before SSR/cache.
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
  '/facts',
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
  return NextResponse.redirect(normalized, 308);
}
