import { isPurgeAuthorized, isPurgeScope } from '../../server/data/purge';
import { operator } from '../../server/data/wiring';

/**
 * Operator endpoints for the process caches. Off unless SITE_PURGE_TOKEN is set (16+ characters), in
 * which case everything here requires `Authorization: Bearer <token>`. Never cacheable (see
 * server/edge/surfaces.cjs: `/internal` is not a document).
 */
const NO_STORE = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' };

function gate(request: Request): Response | null {
  const token = process.env.SITE_PURGE_TOKEN;
  if (!token || token.length < 16)
    return new Response('Not Found', { status: 404, headers: NO_STORE });
  if (!isPurgeAuthorized(request.headers.get('authorization'), token)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { ...NO_STORE, 'www-authenticate': 'Bearer' },
    });
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  return gate(request) ?? Response.json(operator.report(), { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;
  let scope: unknown = 'all';
  const text = await request.text();
  if (text.trim().length > 0) {
    try {
      scope = (JSON.parse(text) as { scope?: unknown }).scope ?? 'all';
    } catch {
      return Response.json(
        { error: 'body must be JSON like {"scope":"all"}' },
        { status: 400, headers: NO_STORE },
      );
    }
  }
  if (!isPurgeScope(scope)) {
    return Response.json(
      { error: 'scope must be one of all, catalog, release-pointer' },
      { status: 400, headers: NO_STORE },
    );
  }
  return Response.json(operator.purge(scope), { headers: NO_STORE });
}
