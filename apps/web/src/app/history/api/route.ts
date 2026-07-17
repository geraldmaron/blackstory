/**
 * Public history refine endpoint (BB-093). Node.js runtime (App Check Admin SDK). Thin entry
 * wiring production singletons; testable core lives in `./handler`.
 */
import { createHistoryAppCheckGuard, type HistoryAppCheckGuard } from './app-check-guard';
import { createHistoryRateLimitGuard } from './rate-limit-guard';
import { handleHistoryRefineRequest } from './handler';

export const runtime = 'nodejs';

const defaultRateLimitGuard = createHistoryRateLimitGuard();

let defaultAppCheckGuardPromise: Promise<HistoryAppCheckGuard> | undefined;
function getDefaultAppCheckGuard(): Promise<HistoryAppCheckGuard> {
  if (!defaultAppCheckGuardPromise) {
    defaultAppCheckGuardPromise = createHistoryAppCheckGuard();
  }
  return defaultAppCheckGuardPromise;
}

export async function GET(request: Request): Promise<Response> {
  const appCheckGuard = await getDefaultAppCheckGuard();
  return handleHistoryRefineRequest(request, {
    appCheckGuard,
    rateLimitGuard: defaultRateLimitGuard,
  });
}
