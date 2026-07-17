/**
 * Edge middleware — BB-028 web security composed with BB-022 query normalization.
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
    '/facts',
    '/legal',
    '/legal/:path*',
    '/facts/:path*',
    '/errata',
    '/errata/:path*',
    '/myths',
    '/myths/:path*',
    '/about',
    '/methodology',
    '/topics',
    '/corrections',
    '/submit',
    '/submit/api',
  ],
};
