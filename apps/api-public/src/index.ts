/**
 * Public read/search/location API entrypoint (Cloud Run target).
 * Read-only posture enforced via @black-book/config surface capabilities (BB-021).
 */
import { buildSurfaceHealth, parseNodeEnv } from '@black-book/config';
import { SURFACE_ID } from './posture.js';

export { createPublicApiAppCheckGuard } from './app-check.js';
export type { PublicApiAppCheckOptions } from './app-check.js';
export {
  createPublicRateLimitGuard,
  resolvePublicEndpointClass,
} from './rate-limits.js';
export type {
  PublicRateLimitGuardDecision,
  PublicRateLimitGuardOptions,
  PublicRateLimitRequest,
} from './rate-limits.js';
export {
  createPublicSearchGuard,
  isPublicSearchPath,
  parsePublicSearchQuery,
  formatSearchGuardDeniedResponse,
} from './search-guardrails.js';
export type {
  PublicSearchHttpQuery,
  PublicSearchGuardRequest,
  PublicSearchGuardDecision,
  PublicSearchGuardDeniedResponse,
} from './search-guardrails.js';
export { guardIncomingAuth, guardMutationAttempt, guardReadOperation } from './posture.js';

export function health() {
  return buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(health()));
}
