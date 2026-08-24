/**
 * Edge entry point for maintenance mode.
 *
 * Runs first in `proxy.ts`, ahead of every security and normalization step, because the whole
 * value of the wall is that nothing downstream runs at all. A blocked request never reaches a
 * route, never renders a React tree, and never opens a connection to `bb_public`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { secureCookieDefaults } from '../web-security/cookies';
import { applySecurityHeaders } from '../web-security/security-headers';
import {
  MAINTENANCE_BYPASS_HINT_COOKIE,
  MAINTENANCE_BYPASS_HINT_VALUE,
} from './maintenance-bypass-hint';
import { renderMaintenancePage } from './maintenance-page';
import {
  MAINTENANCE_BYPASS_COOKIE,
  MAINTENANCE_BYPASS_HEADER,
  MAINTENANCE_BYPASS_MAX_AGE_SECONDS,
  MAINTENANCE_BYPASS_PARAM,
  decideMaintenance,
  readMaintenanceSettings,
  type MaintenanceSettings,
} from './maintenance-policy';

/**
 * Answer the request if the wall applies to it; return `null` to let normal handling proceed.
 *
 * `null` rather than `NextResponse.next()` so the caller keeps ownership of the pass-through
 * response and the security/normalization chain stays exactly as it was when the wall is down.
 */
export function handleMaintenance(
  request: NextRequest,
  settings: MaintenanceSettings = readMaintenanceSettings(),
): NextResponse | null {
  const { nextUrl } = request;

  const decision = decideMaintenance(settings, {
    pathname: nextUrl.pathname,
    bypassParam: nextUrl.searchParams.get(MAINTENANCE_BYPASS_PARAM),
    bypassCookie: request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value ?? null,
    bypassHeader: request.headers.get(MAINTENANCE_BYPASS_HEADER),
  });

  switch (decision.kind) {
    case 'pass':
    case 'bypass':
      return null;
    case 'grant-bypass':
      return grantBypass(request, settings);
    case 'block':
      return blockedResponse(settings);
  }
}

/**
 * Exchange a valid `?maintenance_bypass=` for the cookie, then redirect to the same URL without
 * it.
 *
 * The redirect is the point. Left in the address bar the token gets pasted into chat, captured
 * in a `Referer` on the first outbound link, and logged by every analytics hop in between. One
 * extra hop per operator, once per month, buys a token that only ever exists in a HttpOnly
 * cookie afterwards.
 */
function grantBypass(request: NextRequest, settings: MaintenanceSettings): NextResponse {
  const target = request.nextUrl.clone();
  target.searchParams.delete(MAINTENANCE_BYPASS_PARAM);

  const response = NextResponse.redirect(target, 307);
  response.cookies.set(
    MAINTENANCE_BYPASS_COOKIE,
    settings.bypassToken,
    secureCookieDefaults({ maxAge: MAINTENANCE_BYPASS_MAX_AGE_SECONDS }),
  );
  // Non-secret companion, readable by script. See `maintenance-bypass-hint.ts` for why the
  // credential alone is not enough.
  response.cookies.set(
    MAINTENANCE_BYPASS_HINT_COOKIE,
    MAINTENANCE_BYPASS_HINT_VALUE,
    secureCookieDefaults({ httpOnly: false, maxAge: MAINTENANCE_BYPASS_MAX_AGE_SECONDS }),
  );
  // A redirect that hands out a credential must never be cached anywhere.
  response.headers.set('Cache-Control', 'no-store');
  applySecurityHeaders(response.headers);
  return response;
}

/** The 503 itself. */
function blockedResponse(settings: MaintenanceSettings): NextResponse {
  const body = renderMaintenancePage({
    retryAfterSeconds: settings.retryAfterSeconds,
    ...(settings.message ? { message: settings.message } : {}),
  });

  const response = new NextResponse(body, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(settings.retryAfterSeconds),
      // `no-store` rather than a shared-cache TTL, and `Vary: Cookie` alongside it. A cached 503
      // would be served to an operator holding a valid bypass cookie, which is precisely the one
      // reader who must not see it. The saving is not lost: the expensive part of a request here
      // is the function render and the database round trip, and neither happens either way.
      'Cache-Control': 'no-store, must-revalidate',
      Vary: 'Cookie',
      // Belt and braces with the `<meta name="robots">` in the document: the header also covers
      // the non-HTML paths (`/sitemap.xml`, `/robots.txt`) that now answer with this same body.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

  applySecurityHeaders(response.headers);
  return response;
}
