/**
 * Public API rate-limit guard maps read/search/location routes to quota policies.
 * Uses in-memory store by default; inject a shared store for production rollouts.
 */
import {
  aggregateDistributedRisk,
  buildRateLimitKey,
  createInMemoryRateLimitStore,
  createRateLimitEvaluator,
  formatRateLimitResponse,
  releaseConcurrency,
  type EndpointClass,
  type QuotaDecision,
  type RateLimitStore,
  type RateLimitSubject,
  type RiskSignal,
} from '@blap/security';

export type PublicRateLimitRequest = {
  readonly method: string;
  readonly path: string;
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly userId?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
  readonly appCheckVerified?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
};

export type PublicRateLimitGuardDecision = QuotaDecision & {
  readonly endpointClass: EndpointClass;
  readonly key: string;
  readonly riskAggregation?: ReturnType<typeof aggregateDistributedRisk>;
};

export type PublicRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

const PUBLIC_PATH_PATTERNS: ReadonlyArray<{ pattern: RegExp; endpointClass: EndpointClass }> = [
  { pattern: /^\/v1\/search(?:\/|$)/i, endpointClass: 'search' },
  { pattern: /^\/v1\/locations\/geocode(?:\/|$)/i, endpointClass: 'geocoding' },
  { pattern: /^\/v1\/locations\/nearby(?:\/|$)/i, endpointClass: 'nearbyDiscovery' },
  { pattern: /^\/v1\/entities\/[^/]+\/sources(?:\/|$)/i, endpointClass: 'sourceInspection' },
  { pattern: /^\/v1\/entities(?:\/|$)/i, endpointClass: 'entityRetrieval' },
  { pattern: /^\/v1\/auth\/password-reset(?:\/|$)/i, endpointClass: 'passwordReset' },
  { pattern: /^\/v1\/auth(?:\/|$)/i, endpointClass: 'authentication' },
];

/** Resolves a public API path to an endpoint quota class.  */
export function resolvePublicEndpointClass(path: string, method: string): EndpointClass | null {
  const normalized = path.split('?')[0] ?? path;
  if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
    return null;
  }
  for (const entry of PUBLIC_PATH_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.endpointClass;
    }
  }
  return null;
}

export function createPublicRateLimitGuard(options: PublicRateLimitGuardOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const evaluator = createRateLimitEvaluator({
    store,
    ...(options.now ? { now: options.now } : {}),
    ...(options.riskScoreThreshold !== undefined
      ? { riskScoreThreshold: options.riskScoreThreshold }
      : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: PublicRateLimitRequest): PublicRateLimitGuardDecision | null {
      const endpointClass = resolvePublicEndpointClass(request.path, request.method);
      if (!endpointClass) {
        return null;
      }

      const key = buildRateLimitKey({
        subject: request.subject,
        endpointClass,
        ...(request.userId ? { userId: request.userId } : {}),
        ...(request.clientIp ? { clientIp: request.clientIp } : {}),
        ...(request.deviceId ? { deviceId: request.deviceId } : {}),
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
      });

      const riskAggregation = aggregateDistributedRisk(
        request.riskSignals ?? [],
        now(),
        options.riskScoreThreshold,
      );

      const decision = evaluator.evaluate({
        subject: request.subject,
        endpointClass,
        key,
        ...(request.appCheckVerified !== undefined
          ? { appCheckVerified: request.appCheckVerified }
          : {}),
        ...(request.riskSignals ? { riskSignals: request.riskSignals } : {}),
      });

      return { ...decision, endpointClass, key, riskAggregation };
    },

    release(key: string): void {
      releaseConcurrency(store, key, now());
    },

    formatDeniedResponse(decision: Extract<QuotaDecision, { allowed: false }>) {
      return formatRateLimitResponse(decision);
    },
  };
}
