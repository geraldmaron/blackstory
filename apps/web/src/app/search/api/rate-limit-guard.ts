/**
 * Public-search rate-limit guard using the shared security evaluator, keying, distributed-risk
 * and concurrency-release primitives. Search uses the expensive_read policy class; submission
 * uses mutation quotas. Client-header presence is a spoofable protocol signal and never
 * authentication.
 */
import {
  aggregateDistributedRisk,
  buildRateLimitKey,
  createInMemoryRateLimitStore,
  createRateLimitEvaluator,
  formatRateLimitResponse,
  releaseConcurrency,
  SEARCH_ENDPOINT_CLASS,
  type EndpointClass,
  type QuotaDecision,
  type RateLimitStore,
  type RateLimitSubject,
  type RiskSignal,
} from '@repo/security';

const ENDPOINT_CLASS: EndpointClass = SEARCH_ENDPOINT_CLASS;

export type SearchRateLimitRequest = {
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
  readonly clientAttested?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
};

export type SearchRateLimitDecision = QuotaDecision & {
  readonly key: string;
  readonly riskAggregation: ReturnType<typeof aggregateDistributedRisk>;
};

export type SearchRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

export function createSearchRateLimitGuard(options: SearchRateLimitGuardOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const riskScoreThreshold = options.riskScoreThreshold ?? 10;
  const evaluator = createRateLimitEvaluator({
    store,
    riskScoreThreshold,
    ...(options.now ? { now: options.now } : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: SearchRateLimitRequest): SearchRateLimitDecision {
      const key = buildRateLimitKey({
        subject: request.subject,
        endpointClass: ENDPOINT_CLASS,
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
        endpointClass: ENDPOINT_CLASS,
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
