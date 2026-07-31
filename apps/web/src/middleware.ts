/**
 * Edge middleware web security composed with query normalization.
 */

import { type NextRequest } from 'next/server';
import { handleWebSecurity } from './lib/web-security/edge-security';

export function middleware(request: NextRequest) {
  return handleWebSecurity(request);
}

/**
 * Public HTML routes only. API paths must never appear here: an endpoint's contract *is* its
 * query string, and normalization 308s it away before the handler ever parses it. `/history/api`
 * and `/submit/api` were the two that had slipped in, both with an empty allowlist, so both were
 * answering a stripped request. Every other endpoint (`/explore/api`, `/search/api`,
 * `/locate/api`, the `/corrections/*` handlers) is already out and stays out.
 */
export const config = {
  matcher: [
    '/',
    '/search',
    '/entity/:path*',
    '/explore',
    '/history',
    '/law',
    '/law/:path*',
    '/legal',
    '/legal/:path*',
    '/errata',
    '/errata/:path*',
    '/about',
    '/methodology',
    '/chapters',
    '/chapters/:path*',
    '/corrections',
    '/submit',
  ],
};
