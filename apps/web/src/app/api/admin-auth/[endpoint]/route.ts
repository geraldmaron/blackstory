/**
 * Same-origin transport for the browser's Supabase Auth client. Browser extensions can block
 * supabase.co; the server can reach it. This route carries only the current admin password and
 * session operations, with the project's publishable key and no cacheable response.
 * Authorization still happens in Supabase and at BlackStory's staff-role gates.
 */
import { readSupabaseServerConfig } from '../../../../admin/auth/supabase-session-authorizer';

type RouteContext = { readonly params: Promise<{ readonly endpoint: string }> };

const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store', Pragma: 'no-cache' };
const MAX_BODY_BYTES = 16_384;

function jsonError(status: number, message: string): Response {
  return Response.json({ message }, { status, headers: RESPONSE_HEADERS });
}

async function relay(request: Request, context: RouteContext): Promise<Response> {
  const { endpoint } = await context.params;
  const method = request.method;
  if (!(
    (endpoint === 'token' && method === 'POST') ||
    (endpoint === 'user' && method === 'GET') ||
    (endpoint === 'logout' && method === 'POST')
  )) {
    return jsonError(404, 'Auth operation not found.');
  }

  const incomingUrl = new URL(request.url);
  if (method === 'POST') {
    const origin = request.headers.get('origin');
    // Next can normalize request.url to localhost in development even when the browser used
    // 127.0.0.1. Compare with the actual Host header rather than that normalized URL.
    const requestHost = request.headers.get('host') ?? incomingUrl.host;
    if (origin && (!URL.canParse(origin) || new URL(origin).host !== requestHost)) {
      return jsonError(403, 'Auth request origin is not allowed.');
    }
  }
  if (endpoint === 'token') {
    const grantType = incomingUrl.searchParams.get('grant_type');
    if (grantType !== 'password' && grantType !== 'refresh_token') {
      return jsonError(400, 'Auth grant type is not supported.');
    }
  }

  const statedLength = Number(request.headers.get('content-length'));
  if (method === 'POST' && statedLength > MAX_BODY_BYTES) {
    return jsonError(413, 'Auth request is too large.');
  }
  const body = method === 'POST' ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > MAX_BODY_BYTES) {
    return jsonError(413, 'Auth request is too large.');
  }

  let url: string;
  let anonKey: string;
  try {
    const config = readSupabaseServerConfig();
    url = config.url;
    anonKey = config.anonKey;
  } catch {
    return jsonError(503, 'Sign-in service is not configured.');
  }

  const upstream = new URL(`/auth/v1/${endpoint}${incomingUrl.search}`, url);
  const headers = new Headers({ apikey: anonKey });
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  if (body) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(upstream, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return jsonError(502, 'Sign-in service is unavailable.');
  }
  if (response.status >= 300 && response.status < 400) {
    return jsonError(502, 'Sign-in service returned an unexpected redirect.');
  }

  const clientHeaders = new Headers(RESPONSE_HEADERS);
  const contentType = response.headers.get('content-type');
  if (contentType) clientHeaders.set('content-type', contentType);
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) clientHeaders.set('retry-after', retryAfter);
  return new Response(response.body, { status: response.status, headers: clientHeaders });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return relay(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return relay(request, context);
}
