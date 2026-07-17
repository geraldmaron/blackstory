/**
 * Server-only rate-limit guard for the public "submit a lead" route (BB-025). Reuses the
 * exact shared evaluator from `@black-book/security` — `createRateLimitEvaluator`,
 * `buildRateLimitKey`, `aggregateDistributedRisk`, `formatRateLimitResponse`,
 * `releaseConcurrency` — the same primitives `apps/api-submissions/src/rate-limits.ts` uses for
 * every other public submissions-style mutation. This is deliberately not a new rate-limit
 * algorithm: a community lead is routed under the existing `corrections` endpoint class, the
 * same class `apps/api-submissions` maps `/v1/submissions` onto.
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

export type SubmitLeadRateLimitRequest = {
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
  readonly appCheckVerified?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
};

export type SubmitLeadRateLimitDecision = QuotaDecision & {
  readonly key: string;
  readonly riskAggregation: ReturnType<typeof aggregateDistributedRisk>;
};

export type SubmitLeadRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

export function createSubmitLeadRateLimitGuard(options: SubmitLeadRateLimitGuardOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const riskScoreThreshold = options.riskScoreThreshold ?? 10;
  const evaluator = createRateLimitEvaluator({
    store,
    riskScoreThreshold,
    ...(options.now ? { now: options.now } : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: SubmitLeadRateLimitRequest): SubmitLeadRateLimitDecision {
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
