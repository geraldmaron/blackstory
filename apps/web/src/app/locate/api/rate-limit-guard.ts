/**
 * Server-only rate-limit guard for the public `/locate` geocode route (rate-limited and
 * cached). Reuses the exact shared evaluator from
 * `@repo/security` `createRateLimitEvaluator`, `buildRateLimitKey`,
 * `aggregateDistributedRisk`, `formatRateLimitResponse`, `releaseConcurrency` — the same
 * primitives `apps/web/src/app/search/api/rate-limit-guard.ts` uses. Not a new rate-limit
 * algorithm.
 *
 * This endpoint is routed under the `geocoding` endpoint class, distinct from `search`:
 * `@repo/security`'s policy matrix (`DEFAULT_ENDPOINT_QUOTA_MATRIX` in `rate-limits.ts`)
 * gives `geocoding` an `expensive_read` tier (anonymous: capacity/window 20, daily 120,
 * concurrency 1) sized for explore Place retries while remaining stricter than static entity
 * reads. Every call proxies to the free, unauthenticated, "reasonable use" U.S. Census
 * Geocoder — this repo's own quota bounds call volume against that vendor, not a vendor-
 * issued key (see `packages/domain/src/adapters/census-geo/fetch-geocode.ts`'s module doc).
 * There is no exported `GEOCODING_ENDPOINT_CLASS` constant in `@repo/security` today (only
 * `SEARCH_ENDPOINT_CLASS` exists, in `query-guardrails.ts`) — the literal `'geocoding'` below
 * is typed against the real `EndpointClass` union via `satisfies`, so this still fails to
 * compile if that class is ever renamed or removed.
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

const ENDPOINT_CLASS = 'geocoding' as const satisfies EndpointClass;

export type LocateRateLimitRequest = {
  readonly subject: RateLimitSubject;
  readonly clientIp?: string;
  readonly deviceId?: string;
  readonly sessionId?: string;
  readonly appCheckVerified?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
};

export type LocateRateLimitDecision = QuotaDecision & {
  readonly key: string;
  readonly riskAggregation: ReturnType<typeof aggregateDistributedRisk>;
};

export type LocateRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

export function createLocateRateLimitGuard(options: LocateRateLimitGuardOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const riskScoreThreshold = options.riskScoreThreshold ?? 10;
  const evaluator = createRateLimitEvaluator({
    store,
    riskScoreThreshold,
    ...(options.now ? { now: options.now } : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: LocateRateLimitRequest): LocateRateLimitDecision {
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
