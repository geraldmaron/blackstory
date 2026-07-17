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
export {
  DEFAULT_DISTANCE_THRESHOLD,
  MAX_VECTOR_SEARCH_K,
  VECTOR_SEARCH_PATH,
  evaluateVectorSearchGuardrails,
  formatVectorSearchGuardDeniedResponse,
  isVectorSearchPath,
  toBaseSearchQueryInput,
} from './vector-search-guardrails.js';
export type {
  CanonicalVectorSearchQuery,
  VectorSearchDenialReason,
  VectorSearchGuardDecision,
  VectorSearchGuardDecisionAllowed,
  VectorSearchGuardDecisionDenied,
  VectorSearchGuardDeniedResponse,
  VectorSearchGuardRequest,
  VectorSearchHttpQuery,
} from './vector-search-guardrails.js';
export { VECTOR_SEARCH_KILL_SWITCH_ID, evaluateVectorSearchKillSwitch } from './vector-search-kill-switch.js';
export { createFindNearestEndpoint } from './vector-search-endpoint.js';
export type {
  FindNearestEndpoint,
  FindNearestEndpointOptions,
  FindNearestHttpRequest,
  FindNearestHttpResponse,
  FindNearestMatch,
} from './vector-search-endpoint.js';

export function health() {
  return buildSurfaceHealth(SURFACE_ID, parseNodeEnv(process.env.NODE_ENV));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(health()));
}
