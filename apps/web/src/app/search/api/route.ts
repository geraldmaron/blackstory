/**
 * Public search endpoint. Node.js runtime. This file is deliberately thin: Next.js's route-file
 * validator only permits the HTTP method handlers and route config to be exported here, so the
 * testable, dependency-injectable core lives in `./handler` (`handleSearchRequest`) and this
 * module just wires production singletons.
 *
 * The endpoint sits behind request-integrity + rate limits and runs search guardrails before
 * executing the pure `runPublicSearch` pipeline over `getPublicSearchIndex` (live release entities
 * when available, otherwise the bundled snapshot). See `./handler` for the full request flow.
 */
import { getPublicSearchIndex } from '../../../lib/public-data/source';
import {
  createSearchRequestIntegrityGuard,
  type SearchRequestIntegrityGuard,
} from './request-integrity-guard';
import { createSearchRateLimitGuard } from './rate-limit-guard';
import { handleSearchRequest } from './handler';

export const runtime = 'nodejs';

const defaultRateLimitGuard = createSearchRateLimitGuard();
const defaultIntegrityGuard: SearchRequestIntegrityGuard = createSearchRequestIntegrityGuard();

export async function GET(request: Request): Promise<Response> {
  const index = await getPublicSearchIndex();
  return handleSearchRequest(request, {
    integrityGuard: defaultIntegrityGuard,
    rateLimitGuard: defaultRateLimitGuard,
    searchIndex: index.data,
  });
}
