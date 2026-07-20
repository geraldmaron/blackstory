/**
 * Production `HandlerDeps` composition (MOB-004 live wiring) — the seam between the pure `/v1`
 * handlers and the real world. `../main.ts` (the Cloud Run entrypoint) calls
 * `createProductionHandlerDeps` exactly once at boot; every unit/integration test instead builds
 * its own `HandlerDeps` by hand (see `./server.test.ts`, `./handlers.test.ts`) so this module is
 * never imported by a test that wants to avoid touching real Firebase.
 *
 * Data-source selection: `./live-policy.ts`'s `shouldUsePublicFirestoreDataAccess` decides between
 * the live Firestore adapter (`./firestore-data-access.ts`) and an EMPTY in-memory adapter — never
 * a fixture/sample dataset masquerading as a real release in production. Every other dependency
 * (App Check guard, rate limiter, search guardrail) is real regardless of data source: none of them
 * depend on where entities come from.
 */
import type { EnvironmentLike } from '@repo/firebase';
import { createPublicApiAppCheckGuard } from '../app-check.js';
import { createPublicRateLimitGuard } from '../rate-limits.js';
import { createPublicSearchGuard } from '../search-guardrails.js';
import { createAppCheckAvailabilityProvider } from './app-check-availability.js';
import { createFirestorePublicDataAccess, createInMemoryPublicDataAccess } from './data-access.js';
import { createFirestoreDataAccessReaders } from './firestore-data-access.js';
import type { HandlerDeps } from './handlers.js';
import { shouldUsePublicFirestoreDataAccess } from './live-policy.js';

export type ComposeHandlerDepsOptions = {
  readonly environment?: EnvironmentLike;
};

export function createProductionHandlerDeps(options: ComposeHandlerDepsOptions = {}): HandlerDeps {
  const environment = options.environment ?? process.env;

  const dataAccess = shouldUsePublicFirestoreDataAccess(environment)
    ? createFirestorePublicDataAccess(createFirestoreDataAccessReaders({ environment }))
    : createInMemoryPublicDataAccess({ entities: [] });

  return {
    dataAccess,
    appCheckGuard: createPublicApiAppCheckGuard({ environment }),
    rateLimitGuard: createPublicRateLimitGuard(),
    searchGuard: createPublicSearchGuard(),
    appCheckAvailability: createAppCheckAvailabilityProvider({ environment }),
  };
}
