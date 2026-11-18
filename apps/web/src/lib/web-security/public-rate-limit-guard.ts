/**
 * Per-endpoint rate-limit guard for the public web routes, over `@repo/security`'s shared
 * evaluator, keying, distributed-risk and concurrency-release primitives. Each route builds its
 * own guard (its own store) under its endpoint class; the policy math lives in the matrix.
 * The store is per function instance; see docs/security/rate-limits.md for the edge limit.
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
} from '@repo/security';

export type PublicRateLimitRequest = {
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
  readonly clientAttested?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
};

export type PublicRateLimitDecision = QuotaDecision & {
  readonly key: string;
  readonly riskAggregation: ReturnType<typeof aggregateDistributedRisk>;
};

export type PublicRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

export function createPublicRateLimitGuard(
  endpointClass: EndpointClass,
  options: PublicRateLimitGuardOptions = {},
) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const riskScoreThreshold = options.riskScoreThreshold ?? 10;
  const evaluator = createRateLimitEvaluator({
    store,
    riskScoreThreshold,
    ...(options.now ? { now: options.now } : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: PublicRateLimitRequest): PublicRateLimitDecision {
      const key = buildRateLimitKey({
        subject: request.subject,
        endpointClass,
        ...(request.clientIp ? { clientIp: request.clientIp } : {}),
        ...(request.deviceId ? { deviceId: request.deviceId } : {}),
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
      });

      const riskAggregation = aggregateDistributedRisk(
        request.riskSignals ?? [],
        now(),
        riskScoreThreshold,
      );

      const decision = evaluator.evaluate({
        subject: request.subject,
        endpointClass,
        key,
        ...(request.clientAttested !== undefined ? { clientAttested: request.clientAttested } : {}),
        ...(request.riskSignals ? { riskSignals: request.riskSignals } : {}),
      });

      return { ...decision, key, riskAggregation };
    },

    release(key: string): void {
      releaseConcurrency(store, key, now());
    },

    formatDeniedResponse(decision: Extract<QuotaDecision, { allowed: false }>) {
      return formatRateLimitResponse(decision);
    },
  };
}
