/**
 * Edge middleware web security composed with query normalization.
 */

import { type NextRequest } from 'next/server';
import { handleWebSecurity } from './lib/web-security/edge-security';

export function middleware(request: NextRequest) {
  return handleWebSecurity(request);
}

export const config = {
  matcher: [
    '/',
    '/search',
    '/entity/:path*',
    '/explore',
    '/history',
    '/history/api',
    '/law',
    '/law/:path*',
    '/legal',
    '/legal/:path*',
    '/errata',
    '/errata/:path*',
    '/about',
    '/methodology',
    '/topics',
    '/stories',
    '/stories/:path*',
    '/corrections',
    '/submit',
    '/submit/api',
  ],
};
