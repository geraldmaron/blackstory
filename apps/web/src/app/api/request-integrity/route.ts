import { NextResponse } from 'next/server';
import { buildCsrfSetCookieHeader, generateCsrfToken } from '../../../lib/web-security/csrf';

export const runtime = 'nodejs';

export function GET(request: Request): Response {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'cross_site_request' }, { status: 403 });
  }
  const token = generateCsrfToken();
  return NextResponse.json(
    { token },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store, max-age=0',
        'set-cookie': buildCsrfSetCookieHeader(token),
      },
    },
  );
}
