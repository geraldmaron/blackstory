/**
 * Public geocode endpoint. Node.js runtime (App Check's Admin SDK verifier requires it — not
 * the Edge runtime). This file is deliberately thin: Next.js's route-file validator only permits the
 * HTTP method handlers and route config to be exported here, so the testable,
 * dependency-injectable core lives in `./handler` (`handleLocateRequest`) and this module just
 * wires production singletons.
 *
 * The endpoint sits behind App Check + `geocoding` rate limits and geocodes an address/ZIP
 * (`?address=`) or reverse-geocodes browser coordinates (`?lat=&lng=`) via the real U.S. Census
 * Geocoder adapter (`@black-book/domain`'s `fetchCensusAddressGeocode` and
 * `fetchCensusCoordinatesGeocode`, backed by `../../../lib/geocode/safe-http-client.ts`); see
 * `./handler` for the full request flow.
 */
import { createLocateCache } from '../../../lib/geocode/pipeline';
import { createLocateAppCheckGuard, type LocateAppCheckGuard } from './app-check-guard';
import { createLocateRateLimitGuard } from './rate-limit-guard';
import { handleLocateRequest } from './handler';

export const runtime = 'nodejs';

// Module-level singletons: one in-memory rate-limit store and one geocode cache per server
// instance, matching the search route's posture (`../../search/api/route.ts`'s module doc). A
// shared store for a multi-instance deployment is an infra concern, not a change to the
// algorithm. The App Check guard is created lazily (its factory dynamically imports
// `@black-book/firebase`) and cached so only one is built per instance.
const defaultRateLimitGuard = createLocateRateLimitGuard();
const defaultCache = createLocateCache();

let defaultAppCheckGuardPromise: Promise<LocateAppCheckGuard> | undefined;
function getDefaultAppCheckGuard(): Promise<LocateAppCheckGuard> {
  if (!defaultAppCheckGuardPromise) {
    defaultAppCheckGuardPromise = createLocateAppCheckGuard();
  }
  return defaultAppCheckGuardPromise;
}

export async function GET(request: Request): Promise<Response> {
  const appCheckGuard = await getDefaultAppCheckGuard();
  return handleLocateRequest(request, {
    appCheckGuard,
    rateLimitGuard: defaultRateLimitGuard,
    cache: defaultCache,
  });
}
