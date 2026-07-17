/**
 * Public explore refine endpoint (BB-051). Node.js runtime (App Check Admin SDK). Thin entry
 * wiring production singletons; testable core lives in `./handler`.
 */
import { createExploreAppCheckGuard, type ExploreAppCheckGuard } from './app-check-guard';
import { createExploreRateLimitGuard } from './rate-limit-guard';
import { handleExploreRefineRequest } from './handler';

export const runtime = 'nodejs';

const defaultRateLimitGuard = createExploreRateLimitGuard();

let defaultAppCheckGuardPromise: Promise<ExploreAppCheckGuard> | undefined;
function getDefaultAppCheckGuard(): Promise<ExploreAppCheckGuard> {
  if (!defaultAppCheckGuardPromise) {
    defaultAppCheckGuardPromise = createExploreAppCheckGuard();
  }
  return defaultAppCheckGuardPromise;
}

export async function GET(request: Request): Promise<Response> {
  const appCheckGuard = await getDefaultAppCheckGuard();
  return handleExploreRefineRequest(request, {
    appCheckGuard,
    rateLimitGuard: defaultRateLimitGuard,
  });
}
