/**
 * Public history refine endpoint. Node.js runtime. Thin entry wiring production singletons;
 * testable core lives in `./handler`.
 */
import {
  createHistoryRequestIntegrityGuard,
  type HistoryRequestIntegrityGuard,
} from './request-integrity-guard';
import { createHistoryRateLimitGuard } from './rate-limit-guard';
import { handleHistoryRefineRequest } from './handler';

export const runtime = 'nodejs';

const defaultRateLimitGuard = createHistoryRateLimitGuard();
const defaultIntegrityGuard: HistoryRequestIntegrityGuard = createHistoryRequestIntegrityGuard();

export async function GET(request: Request): Promise<Response> {
  return handleHistoryRefineRequest(request, {
    integrityGuard: defaultIntegrityGuard,
    rateLimitGuard: defaultRateLimitGuard,
  });
}
