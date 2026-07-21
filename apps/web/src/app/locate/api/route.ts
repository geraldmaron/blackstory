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
