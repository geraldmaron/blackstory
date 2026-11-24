import { NextResponse } from 'next/server';
import { cookieValue } from '../../../lib/request-integrity/server';
import {
  CSRF_COOKIE_NAME,
  buildCsrfSetCookieHeader,
  generateCsrfToken,
  isMintedCsrfToken,
} from '../../../lib/web-security/csrf';

export const runtime = 'nodejs';

export function GET(request: Request): Response {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'cross_site_request' }, { status: 403 });
  }
  /*
   * Every tab shares the one cookie, so minting on each call made a second tab invalidate the
   * first tab's form. A cookie this route minted is handed back as it is, with no Set-Cookie, so
   * its lifetime is never extended; anything else gets a fresh mint.
   */
  const existing = cookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME);
  const reuse = existing !== null && isMintedCsrfToken(existing);
  const token = reuse ? existing : generateCsrfToken();
  return NextResponse.json(
    { token },
    {
      status: 200,
      headers: {
        // A reused token has no Set-Cookie to keep it out of a shared cache; say so outright.
        'cache-control': 'private, no-store, max-age=0',
        vary: 'Cookie',
        ...(reuse ? {} : { 'set-cookie': buildCsrfSetCookieHeader(token) }),
      },
    },
  );
}
