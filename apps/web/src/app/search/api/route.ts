/**
 * Public search endpoint. Node.js runtime (App Check's Admin SDK verifier requires it — not
 * the Edge runtime). This file is deliberately thin: Next.js's route-file validator only permits the HTTP
 * method handlers and route config to be exported here, so the testable, dependency-injectable core
 * lives in `./handler` (`handleSearchRequest`) and this module just wires production singletons.
 *
 * The endpoint sits behind App Check + rate limits and runs search guardrails
 * before executing the pure `runPublicSearch` pipeline over `getPublicSearchIndex`
 * (live release entities when available, otherwise the bundled snapshot). See
 * `./handler` for the full request flow.
 */
import { getPublicSearchIndex } from '../../../lib/public-data/source';
import { createSearchAppCheckGuard, type SearchAppCheckGuard } from './app-check-guard';
import { createSearchRateLimitGuard } from './rate-limit-guard';
import { handleSearchRequest } from './handler';

export const runtime = 'nodejs';

// Module-level singletons: one in-memory rate-limit store per server instance, matching the submit
// route's posture. A shared store for a multi-instance deployment is an infra concern, not a change
// to the algorithm. The App Check guard is created lazily (its factory dynamically imports
// `@blap/firebase`; see `./app-check-guard.ts`) and cached so only one is built per instance.
const defaultRateLimitGuard = createSearchRateLimitGuard();

let defaultAppCheckGuardPromise: Promise<SearchAppCheckGuard> | undefined;
function getDefaultAppCheckGuard(): Promise<SearchAppCheckGuard> {
  if (!defaultAppCheckGuardPromise) {
    defaultAppCheckGuardPromise = createSearchAppCheckGuard();
  }
  return defaultAppCheckGuardPromise;
}

export async function GET(request: Request): Promise<Response> {
  const appCheckGuard = await getDefaultAppCheckGuard();
  const index = await getPublicSearchIndex();
  return handleSearchRequest(request, {
    appCheckGuard,
    rateLimitGuard: defaultRateLimitGuard,
    searchIndex: index.data,
  });
}
