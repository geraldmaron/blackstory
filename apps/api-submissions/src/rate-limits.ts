/**
 * Submissions API rate-limit guard — corrections and auth intake quotas (BB-025).
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

export type SubmissionsRateLimitRequest = {
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

export type SubmissionsRateLimitGuardDecision = QuotaDecision & {
  readonly endpointClass: EndpointClass;
  readonly key: string;
  readonly riskAggregation?: ReturnType<typeof aggregateDistributedRisk>;
};

export type SubmissionsRateLimitGuardOptions = {
  readonly store?: RateLimitStore;
  readonly now?: () => number;
  readonly riskScoreThreshold?: number;
};

const SUBMISSIONS_PATH_PATTERNS: ReadonlyArray<{ pattern: RegExp; endpointClass: EndpointClass }> =
  [
    { pattern: /^\/v1\/corrections(?:\/|$)/i, endpointClass: 'corrections' },
    { pattern: /^\/v1\/submissions(?:\/|$)/i, endpointClass: 'corrections' },
    { pattern: /^\/v1\/auth\/password-reset(?:\/|$)/i, endpointClass: 'passwordReset' },
    { pattern: /^\/v1\/auth(?:\/|$)/i, endpointClass: 'authentication' },
    { pattern: /^\/v1\/admin\/exports(?:\/|$)/i, endpointClass: 'adminExport' },
    { pattern: /^\/v1\/admin\/research(?:\/|$)/i, endpointClass: 'researchStart' },
    {
      pattern: /^\/v1\/admin\/publication\/preview(?:\/|$)/i,
      endpointClass: 'publicationPreview',
    },
  ];

export function resolveSubmissionsEndpointClass(path: string): EndpointClass | null {
  const normalized = path.split('?')[0] ?? path;
  for (const entry of SUBMISSIONS_PATH_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.endpointClass;
    }
  }
  return null;
}

export function createSubmissionsRateLimitGuard(options: SubmissionsRateLimitGuardOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const riskScoreThreshold = options.riskScoreThreshold ?? 10;
  const evaluator = createRateLimitEvaluator({
    store,
    riskScoreThreshold,
    ...(options.now ? { now: options.now } : {}),
  });
  const now = options.now ?? (() => Date.now());

  return {
    evaluate(request: SubmissionsRateLimitRequest): SubmissionsRateLimitGuardDecision | null {
      const endpointClass = resolveSubmissionsEndpointClass(request.path);
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
        riskScoreThreshold,
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
