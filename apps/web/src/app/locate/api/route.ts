/**
 * Public geocode endpoint. Node.js runtime. Thin Next entry: wires production
 * singletons and delegates to `handleLocateRequest` in `./handler`.
 *
 * Behind request-integrity + `geocoding` rate limits; geocodes address/ZIP or
 * reverse-geocodes coordinates via the Census adapter.
 */
import { createLocateCache } from '../../../lib/geocode/pipeline';
import {
  createLocateRequestIntegrityGuard,
  type LocateRequestIntegrityGuard,
} from './request-integrity-guard';
import { createLocateRateLimitGuard } from './rate-limit-guard';
import { handleLocateRequest } from './handler';

export const runtime = 'nodejs';

const defaultRateLimitGuard = createLocateRateLimitGuard();
const defaultCache = createLocateCache();
const defaultIntegrityGuard: LocateRequestIntegrityGuard = createLocateRequestIntegrityGuard();

export async function GET(request: Request): Promise<Response> {
  return handleLocateRequest(request, {
    integrityGuard: defaultIntegrityGuard,
    rateLimitGuard: defaultRateLimitGuard,
    cache: defaultCache,
  });
}

/**
 * The same lookup with the typed place in the request body. A query string is written to
 * access logs and browser history; a body is not. The browser client uses this form, so a town
 * a reader types never sits in a URL (DESIGN.md section 12, the privacy gate).
 */
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const url = new URL(request.url);
  url.search = '';
  if (body && typeof body === 'object') {
    const { address, camera } = body as { address?: unknown; camera?: unknown };
    if (typeof address === 'string') url.searchParams.set('address', address);
    if (camera === true) url.searchParams.set('camera', '1');
  }
  return GET(new Request(url, { headers: request.headers }));
}
