/**
 * Server-only rate-limit guard for the public search route. Reuses the
 * exact shared evaluator from `@repo/security` `createRateLimitEvaluator`,
 * `buildRateLimitKey`, `aggregateDistributedRisk`, `formatRateLimitResponse`,
 * `releaseConcurrency` — the same primitives `apps/web/src/app/submit/rate-limit-guard.ts` uses.
 * This is not a new rate-limit algorithm.
 *
 * Deliberate deviation from the submit guard: this endpoint is routed under the `search` endpoint
 * class, not `corrections`. `@repo/security`'s policy matrix (`DEFAULT_ENDPOINT_QUOTA_MATRIX`
 * in `rate-limits.ts`) gives `search` a distinct, more generous `expensive_read` tier
 * (anonymous: capacity 8 window cap 8 daily 40 concurrency 1) than the `corrections`
 * `mutation` tier (anonymous: capacity 2 window cap 2 daily 8) appropriate for an
 * idempotent read path a user can legitimately fire repeatedly (typeahead, pagination), while
 * still requiring verified App Check for anonymous callers (the `expensive_read` cost tier gate in
 * `evaluateQuota`). `SEARCH_ENDPOINT_CLASS` from the guardrails is the canonical name for
 * this class.
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
  readonly appCheckVerified?: boolean;
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
