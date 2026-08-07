/**
 * Edge web security composed with query normalization.
 *
 * Was `middleware.ts`. Next 16 deprecated that file convention in favour of `proxy`; the rename is
 * the whole migration — same request object, same `config.matcher` semantics, same edge runtime.
 * Only the file name and the exported function name changed.
 */

import { type NextRequest } from 'next/server';
import { handleWebSecurity } from './lib/web-security/edge-security';

export function proxy(request: NextRequest) {
  return handleWebSecurity(request);
}

/**
 * Public HTML routes only. Endpoints must never appear here: an endpoint's contract *is* its
 * query string, and normalization 308s it away before the handler ever parses it. `/history/api`
 * and `/submit/api` were the two that had slipped in, both with an empty allowlist, so both were
 * answering a stripped request. Every other endpoint (`/explore/api`, `/search/api`,
 * `/locate/api`, the `/corrections/*` handlers) is already out and stays out.
 *
 * `/history` is out for exactly that reason: it renders nothing and exists only to map `decade`
 * onto `era` and resolve to `/records`. Matched, its parse→build normalization rewrote the
 * reader's own params first — a bare `decade=1930` failed the `\d{4}s` parse and was dropped
 * outright — so the fold cost two hops and lost the decade on the way. `/search` stays matched:
 * it carries a free-text `q` that has to be sanitised before it is echoed anywhere.
 *
 * `/explore` is out because it stopped rendering: it 308s to `/`, which is the Atlas and is
 * matched here. Normalising a path on its way to a redirect only buys a second hop.
 */
export const config = {
  matcher: [
    '/',
    '/search',
    '/entity/:path*',
    '/law',
    '/law/:path*',
    '/legal',
    '/legal/:path*',
    '/errata',
    '/errata/:path*',
    '/about',
    '/methodology',
    '/stories',
    '/stories/:path*',
    '/corrections',
    '/submit',
  ],
};
