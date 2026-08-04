/**
 * Public explore refine endpoint. Node.js runtime. Thin entry wiring production singletons;
 * testable core lives in `./handler`.
 */
import {
  createExploreRequestIntegrityGuard,
  type ExploreRequestIntegrityGuard,
} from './request-integrity-guard';
import { createExploreRateLimitGuard } from './rate-limit-guard';
import { handleExploreRefineRequest } from './handler';

export const runtime = 'nodejs';

const defaultRateLimitGuard = createExploreRateLimitGuard();
const defaultIntegrityGuard: ExploreRequestIntegrityGuard = createExploreRequestIntegrityGuard();

export async function GET(request: Request): Promise<Response> {
  return handleExploreRefineRequest(request, {
    integrityGuard: defaultIntegrityGuard,
    rateLimitGuard: defaultRateLimitGuard,
  });
}
