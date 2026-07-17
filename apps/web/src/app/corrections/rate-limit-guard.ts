/**
 * Server-only rate-limit guard for correction intake. Reuses `@black-book/security`'s
 * shared evaluator under the existing `corrections` endpoint class anonymous capacity 2
 * window cap 2 daily 8 so coordinated brigading cannot exhaust the lane silently.
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
} from '@black-book/security';

const ENDPOINT_CLASS: EndpointClass = 'corrections';

export type CorrectionRateLimitRequest = {
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
  readonly appCheckVerified?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
};

export type CorrectionRateLimitDecision = QuotaDecision & {
  readonly key: string;
  readonly riskAggregation: ReturnType<typeof aggregateDistributedRisk>;
};

export type CorrectionRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

export function createCorrectionRateLimitGuard(options: CorrectionRateLimitGuardOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const riskScoreThreshold = options.riskScoreThreshold ?? 10;
  const evaluator = createRateLimitEvaluator({
    store,
    riskScoreThreshold,
    ...(options.now ? { now: options.now } : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: CorrectionRateLimitRequest): CorrectionRateLimitDecision {
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
        ...(request.appCheckVerified !== undefined
          ? { appCheckVerified: request.appCheckVerified }
          : {}),
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
