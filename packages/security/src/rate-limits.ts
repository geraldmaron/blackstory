/**
 * Endpoint rate limits and abuse quotas (BB-025).
 *
 * Pure deterministic policy matrix + token-bucket evaluator with bounded in-memory
 * state. Layered controls: subject quotas, endpoint classes, rolling/daily windows,
 * concurrency caps, and distributed risk-signal aggregation. No external store dependency.
 */

/** Caller identity tier — anonymous receives the smallest quota. */
export type RateLimitSubject = 'anonymous' | 'authenticated' | 'admin' | 'service';

/** Endpoint cost class mapped to quota policy rows. */
export type EndpointClass =
  | 'search'
  | 'geocoding'
  | 'nearbyDiscovery'
  | 'entityRetrieval'
  | 'sourceInspection'
  | 'corrections'
  | 'authentication'
  | 'passwordReset'
  | 'adminExport'
  | 'researchStart'
  | 'publicationPreview';

export const endpointClasses = [
  'search',
  'geocoding',
  'nearbyDiscovery',
  'entityRetrieval',
  'sourceInspection',
  'corrections',
  'authentication',
  'passwordReset',
  'adminExport',
  'researchStart',
  'publicationPreview',
] as const satisfies readonly EndpointClass[];

export const rateLimitSubjects = [
  'anonymous',
  'authenticated',
  'admin',
  'service',
] as const satisfies readonly RateLimitSubject[];

/** Observable abuse dimensions beyond a single IP. */
export type RiskSignalKind =
  | 'ip_burst'
  | 'device_burst'
  | 'session_burst'
  | 'account_rotation'
  | 'missing_app_check'
  | 'geo_velocity'
  | 'endpoint_hopping';

export type RiskSignal = {
  readonly kind: RiskSignalKind;
  readonly weight: number;
  readonly observedAtMs: number;
  /** Hashed or opaque dimension identifier (device, session, account cluster). */
  readonly dimension?: string;
};

export type QuotaDenialReason =
  | 'token_bucket_exhausted'
  | 'rolling_window_exceeded'
  | 'daily_cap_exceeded'
  | 'concurrency_exceeded'
  | 'risk_score_exceeded'
  | 'app_check_required';

export type QuotaDecisionAllowed = {
  readonly allowed: true;
  readonly remaining: number;
  readonly resetAtMs: number;
  readonly concurrencyRemaining: number;
  readonly policyVersion: string;
};

export type QuotaDecisionDenied = {
  readonly allowed: false;
  readonly reason: QuotaDenialReason;
  readonly retryAfterMs: number;
  readonly safeRetryAfterSec: number;
  readonly policyVersion: string;
};

export type QuotaDecision = QuotaDecisionAllowed | QuotaDecisionDenied;

export type EndpointQuotaPolicy = {
  /** Token-bucket burst capacity. */
  readonly capacity: number;
  /** Tokens refilled per second. */
  readonly refillPerSec: number;
  /** Rolling window cap (e.g. per minute). */
  readonly windowCap: number;
  readonly windowMs: number;
  /** UTC-day cap (resets on calendar day boundary). */
  readonly dailyCap: number;
  /** Max concurrent in-flight requests for this key. */
  readonly maxConcurrency: number;
  /** Cost tier for documentation / ordering checks. */
  readonly costTier: 'static_read' | 'expensive_read' | 'mutation' | 'auth' | 'admin';
};

export type RateLimitEvaluateInput = {
  readonly subject: RateLimitSubject;
  readonly endpointClass: EndpointClass;
  readonly key: string;
  readonly nowMs?: number;
  readonly consume?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
  readonly appCheckVerified?: boolean;
};

export type TokenBucketState = {
  tokens: number;
  lastRefillMs: number;
  windowStartMs: number;
  windowCount: number;
  dailyStartMs: number;
  dailyCount: number;
  activeConcurrency: number;
};

export type RateLimitStoreEntry = {
  readonly state: TokenBucketState;
  readonly expiresAtMs: number;
};

export type RateLimitStore = {
  get(key: string, nowMs: number): TokenBucketState | undefined;
  set(key: string, state: TokenBucketState, ttlMs: number, nowMs: number): void;
  delete(key: string): void;
  size(): number;
};

export type RateLimitStoreOptions = {
  readonly maxKeys?: number;
  readonly defaultTtlMs?: number;
};

export type RateLimitEvaluatorOptions = {
  readonly store?: RateLimitStore;
  readonly policyMatrix?: Partial<
    Record<EndpointClass, Partial<Record<RateLimitSubject, EndpointQuotaPolicy>>>
  >;
  readonly riskScoreThreshold?: number;
  readonly now?: () => number;
};

export const RATE_LIMIT_POLICY_VERSION = '1.0.0' as const;

const MS_PER_DAY = 86_400_000;

const SUBJECT_ORDER: Record<RateLimitSubject, number> = {
  anonymous: 0,
  authenticated: 1,
  admin: 2,
  service: 3,
};

/** Default quota matrix — expensive endpoints are stricter than static reads. */
export const DEFAULT_ENDPOINT_QUOTA_MATRIX: Record<
  EndpointClass,
  Record<RateLimitSubject, EndpointQuotaPolicy>
> = {
  entityRetrieval: {
    anonymous: policy(40, 0.8, 40, 60_000, 300, 3, 'static_read'),
    authenticated: policy(80, 1.5, 80, 60_000, 800, 6, 'static_read'),
    admin: policy(160, 3, 160, 60_000, 3_000, 10, 'static_read'),
    service: policy(400, 8, 400, 60_000, 15_000, 20, 'static_read'),
  },
  sourceInspection: {
    anonymous: policy(30, 0.6, 30, 60_000, 200, 2, 'static_read'),
    authenticated: policy(60, 1.2, 60, 60_000, 600, 4, 'static_read'),
    admin: policy(120, 2.5, 120, 60_000, 2_500, 8, 'static_read'),
    service: policy(300, 6, 300, 60_000, 12_000, 16, 'static_read'),
  },
  search: {
    anonymous: policy(8, 0.15, 8, 60_000, 40, 1, 'expensive_read'),
    authenticated: policy(24, 0.5, 24, 60_000, 180, 3, 'expensive_read'),
    admin: policy(48, 1, 48, 60_000, 500, 5, 'expensive_read'),
    service: policy(120, 2.5, 120, 60_000, 2_000, 10, 'expensive_read'),
  },
  geocoding: {
    anonymous: policy(5, 0.1, 5, 60_000, 25, 1, 'expensive_read'),
    authenticated: policy(15, 0.35, 15, 60_000, 120, 2, 'expensive_read'),
    admin: policy(30, 0.7, 30, 60_000, 350, 4, 'expensive_read'),
    service: policy(80, 1.8, 80, 60_000, 1_500, 8, 'expensive_read'),
  },
  nearbyDiscovery: {
    anonymous: policy(6, 0.12, 6, 60_000, 30, 1, 'expensive_read'),
    authenticated: policy(18, 0.4, 18, 60_000, 150, 2, 'expensive_read'),
    admin: policy(36, 0.8, 36, 60_000, 400, 4, 'expensive_read'),
    service: policy(90, 2, 90, 60_000, 1_800, 8, 'expensive_read'),
  },
  corrections: {
    anonymous: policy(2, 0.03, 2, 60_000, 8, 1, 'mutation'),
    authenticated: policy(6, 0.12, 6, 60_000, 40, 2, 'mutation'),
    admin: policy(20, 0.4, 20, 60_000, 200, 4, 'mutation'),
    service: policy(40, 0.8, 40, 60_000, 500, 6, 'mutation'),
  },
  authentication: {
    anonymous: policy(5, 0.05, 5, 300_000, 20, 1, 'auth'),
    authenticated: policy(10, 0.1, 10, 300_000, 40, 2, 'auth'),
    admin: policy(20, 0.2, 20, 300_000, 80, 3, 'auth'),
    service: policy(60, 0.6, 60, 300_000, 300, 5, 'auth'),
  },
  passwordReset: {
    anonymous: policy(3, 0.03, 3, 900_000, 6, 1, 'auth'),
    authenticated: policy(5, 0.05, 5, 900_000, 10, 1, 'auth'),
    admin: policy(10, 0.1, 10, 900_000, 20, 2, 'auth'),
    service: policy(30, 0.3, 30, 900_000, 100, 3, 'auth'),
  },
  adminExport: {
    anonymous: policy(0, 0, 0, 60_000, 0, 0, 'admin'),
    authenticated: policy(2, 0.03, 2, 60_000, 10, 1, 'admin'),
    admin: policy(10, 0.2, 10, 60_000, 60, 3, 'admin'),
    service: policy(30, 0.6, 30, 60_000, 200, 5, 'admin'),
  },
  researchStart: {
    anonymous: policy(0, 0, 0, 60_000, 0, 0, 'admin'),
    authenticated: policy(1, 0.02, 1, 60_000, 5, 1, 'admin'),
    admin: policy(8, 0.15, 8, 60_000, 40, 2, 'admin'),
    service: policy(20, 0.4, 20, 60_000, 120, 4, 'admin'),
  },
  publicationPreview: {
    anonymous: policy(0, 0, 0, 60_000, 0, 0, 'admin'),
    authenticated: policy(1, 0.02, 1, 60_000, 4, 1, 'admin'),
    admin: policy(6, 0.12, 6, 60_000, 30, 2, 'admin'),
    service: policy(15, 0.3, 15, 60_000, 80, 3, 'admin'),
  },
};

function policy(
  capacity: number,
  refillPerSec: number,
  windowCap: number,
  windowMs: number,
  dailyCap: number,
  maxConcurrency: number,
  costTier: EndpointQuotaPolicy['costTier'],
): EndpointQuotaPolicy {
  return { capacity, refillPerSec, windowCap, windowMs, dailyCap, maxConcurrency, costTier };
}

function startOfUtcDayMs(nowMs: number): number {
  const date = new Date(nowMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function createInitialBucketState(policyRow: EndpointQuotaPolicy, nowMs: number): TokenBucketState {
  return {
    tokens: policyRow.capacity,
    lastRefillMs: nowMs,
    windowStartMs: nowMs,
    windowCount: 0,
    dailyStartMs: startOfUtcDayMs(nowMs),
    dailyCount: 0,
    activeConcurrency: 0,
  };
}

function refillTokens(state: TokenBucketState, policyRow: EndpointQuotaPolicy, nowMs: number): void {
  const elapsedSec = Math.max(0, (nowMs - state.lastRefillMs) / 1000);
  if (elapsedSec <= 0) {
    return;
  }
  state.tokens = Math.min(policyRow.capacity, state.tokens + elapsedSec * policyRow.refillPerSec);
  state.lastRefillMs = nowMs;
}

function resetWindowsIfNeeded(state: TokenBucketState, policyRow: EndpointQuotaPolicy, nowMs: number): void {
  if (nowMs - state.windowStartMs >= policyRow.windowMs) {
    state.windowStartMs = nowMs;
    state.windowCount = 0;
  }
  const dayStart = startOfUtcDayMs(nowMs);
  if (dayStart !== state.dailyStartMs) {
    state.dailyStartMs = dayStart;
    state.dailyCount = 0;
  }
}

/** Rounds retry guidance upward without exposing exact bucket thresholds. */
export function safeRetryAfter(retryAfterMs: number): number {
  const minimumSec = 5;
  const roundedSec = Math.ceil(Math.max(retryAfterMs, 1_000) / 5_000) * 5;
  return Math.max(minimumSec, roundedSec);
}

export type RateLimitResponseBody = {
  readonly error: 'rate_limit_exceeded';
  readonly message: string;
  readonly retryAfterSec: number;
};

export type RateLimitHttpResponse = {
  readonly status: 429;
  readonly headers: { readonly 'Retry-After': string };
  readonly body: RateLimitResponseBody;
};

/** Formats a 429 payload that avoids leaking quota thresholds. */
export function formatRateLimitResponse(decision: QuotaDecisionDenied): RateLimitHttpResponse {
  return {
    status: 429,
    headers: { 'Retry-After': String(decision.safeRetryAfterSec) },
    body: {
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Retry after the indicated interval.',
      retryAfterSec: decision.safeRetryAfterSec,
    },
  };
}

export function aggregateRiskScore(signals: readonly RiskSignal[] | undefined, nowMs: number): number {
  if (!signals?.length) {
    return 0;
  }
  const windowMs = 300_000;
  return signals
    .filter((signal) => nowMs - signal.observedAtMs <= windowMs)
    .reduce((total, signal) => total + Math.max(0, signal.weight), 0);
}

export function buildRateLimitKey(parts: {
  subject: RateLimitSubject;
  endpointClass: EndpointClass;
  userId?: string;
  clientIp?: string;
  deviceId?: string;
  sessionId?: string;
}): string {
  const identity =
    parts.userId ??
    parts.deviceId ??
    parts.sessionId ??
    parts.clientIp ??
    'unknown';
  return `${parts.subject}:${parts.endpointClass}:${identity}`;
}

export function createInMemoryRateLimitStore(options: RateLimitStoreOptions = {}): RateLimitStore {
  const maxKeys = options.maxKeys ?? 10_000;
  const defaultTtlMs = options.defaultTtlMs ?? 3_600_000;
  const entries = new Map<string, RateLimitStoreEntry>();

  function prune(nowMs: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAtMs <= nowMs) {
        entries.delete(key);
      }
    }
    while (entries.size > maxKeys) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      entries.delete(oldestKey);
    }
  }

  return {
    get(key, nowMs) {
      prune(nowMs);
      const entry = entries.get(key);
      if (!entry || entry.expiresAtMs <= nowMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.state;
    },
    set(key, state, ttlMs, nowMs) {
      prune(nowMs);
      entries.set(key, { state, expiresAtMs: nowMs + (ttlMs > 0 ? ttlMs : defaultTtlMs) });
      while (entries.size > maxKeys) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        entries.delete(oldestKey);
      }
    },
    delete(key) {
      entries.delete(key);
    },
    size() {
      return entries.size;
    },
  };
}

export function resolveEndpointPolicy(
  matrix: Record<EndpointClass, Record<RateLimitSubject, EndpointQuotaPolicy>>,
  endpointClass: EndpointClass,
  subject: RateLimitSubject,
): EndpointQuotaPolicy {
  return matrix[endpointClass][subject];
}

export function compareSubjectQuota(
  endpointClass: EndpointClass,
  left: RateLimitSubject,
  right: RateLimitSubject,
  matrix: Record<EndpointClass, Record<RateLimitSubject, EndpointQuotaPolicy>> = DEFAULT_ENDPOINT_QUOTA_MATRIX,
): number {
  const leftPolicy = resolveEndpointPolicy(matrix, endpointClass, left);
  const rightPolicy = resolveEndpointPolicy(matrix, endpointClass, right);
  if (leftPolicy.dailyCap !== rightPolicy.dailyCap) {
    return leftPolicy.dailyCap - rightPolicy.dailyCap;
  }
  return leftPolicy.windowCap - rightPolicy.windowCap;
}

export function isExpensiveEndpointStricter(
  endpointClass: EndpointClass,
  subject: RateLimitSubject = 'anonymous',
  matrix: Record<EndpointClass, Record<RateLimitSubject, EndpointQuotaPolicy>> = DEFAULT_ENDPOINT_QUOTA_MATRIX,
): boolean {
  const expensive = resolveEndpointPolicy(matrix, endpointClass, subject);
  const staticRead = resolveEndpointPolicy(matrix, 'entityRetrieval', subject);
  return expensive.windowCap < staticRead.windowCap && expensive.dailyCap < staticRead.dailyCap;
}

function deny(
  reason: QuotaDenialReason,
  retryAfterMs: number,
): QuotaDecisionDenied {
  return {
    allowed: false,
    reason,
    retryAfterMs,
    safeRetryAfterSec: safeRetryAfter(retryAfterMs),
    policyVersion: RATE_LIMIT_POLICY_VERSION,
  };
}

function allow(
  remaining: number,
  resetAtMs: number,
  concurrencyRemaining: number,
): QuotaDecisionAllowed {
  return {
    allowed: true,
    remaining,
    resetAtMs,
    concurrencyRemaining,
    policyVersion: RATE_LIMIT_POLICY_VERSION,
  };
}

export function evaluateQuota(
  input: RateLimitEvaluateInput,
  options: RateLimitEvaluatorOptions = {},
): QuotaDecision {
  const nowMs = input.nowMs ?? options.now?.() ?? Date.now();
  const matrix = mergePolicyMatrix(options.policyMatrix);
  const policyRow = resolveEndpointPolicy(matrix, input.endpointClass, input.subject);
  const store = options.store ?? createInMemoryRateLimitStore();
  const consume = input.consume ?? true;
  const riskThreshold = options.riskScoreThreshold ?? 12;

  if (policyRow.capacity <= 0 || policyRow.dailyCap <= 0) {
    return deny('daily_cap_exceeded', policyRow.windowMs);
  }

  const riskScore = aggregateRiskScore(input.riskSignals, nowMs);
  if (riskScore >= riskThreshold) {
    return deny('risk_score_exceeded', 60_000);
  }

  if (
    input.subject === 'anonymous' &&
    !input.appCheckVerified &&
    (policyRow.costTier === 'expensive_read' || policyRow.costTier === 'mutation')
  ) {
    return deny('app_check_required', 30_000);
  }

  if (input.appCheckVerified === false && input.riskSignals?.some((s) => s.kind === 'missing_app_check')) {
    return deny('app_check_required', 30_000);
  }

  let state = store.get(input.key, nowMs);
  if (!state) {
    state = createInitialBucketState(policyRow, nowMs);
  }

  resetWindowsIfNeeded(state, policyRow, nowMs);
  refillTokens(state, policyRow, nowMs);

  if (state.activeConcurrency >= policyRow.maxConcurrency) {
    store.set(input.key, state, policyRow.windowMs + MS_PER_DAY, nowMs);
    return deny('concurrency_exceeded', 5_000);
  }

  if (state.dailyCount >= policyRow.dailyCap) {
    const retryAfterMs = state.dailyStartMs + MS_PER_DAY - nowMs;
    store.set(input.key, state, policyRow.windowMs + MS_PER_DAY, nowMs);
    return deny('daily_cap_exceeded', retryAfterMs);
  }

  if (state.windowCount >= policyRow.windowCap) {
    const retryAfterMs = state.windowStartMs + policyRow.windowMs - nowMs;
    store.set(input.key, state, policyRow.windowMs + MS_PER_DAY, nowMs);
    return deny('rolling_window_exceeded', retryAfterMs);
  }

  if (state.tokens < 1) {
    const tokensNeeded = 1 - state.tokens;
    const retryAfterMs = Math.ceil((tokensNeeded / policyRow.refillPerSec) * 1000);
    store.set(input.key, state, policyRow.windowMs + MS_PER_DAY, nowMs);
    return deny('token_bucket_exhausted', retryAfterMs);
  }

  if (consume) {
    state.tokens -= 1;
    state.windowCount += 1;
    state.dailyCount += 1;
    state.activeConcurrency += 1;
  }

  const resetAtMs = Math.min(
    state.windowStartMs + policyRow.windowMs,
    state.dailyStartMs + MS_PER_DAY,
  );

  store.set(input.key, state, policyRow.windowMs + MS_PER_DAY, nowMs);

  return allow(
    Math.floor(state.tokens),
    resetAtMs,
    Math.max(0, policyRow.maxConcurrency - state.activeConcurrency),
  );
}

/** Release a concurrency slot after request completion. */
export function releaseConcurrency(
  store: RateLimitStore,
  key: string,
  nowMs: number = Date.now(),
): void {
  const state = store.get(key, nowMs);
  if (!state) {
    return;
  }
  state.activeConcurrency = Math.max(0, state.activeConcurrency - 1);
  store.set(key, state, MS_PER_DAY, nowMs);
}

export function createRateLimitEvaluator(options: RateLimitEvaluatorOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore();
  const now = options.now ?? (() => Date.now());

  return {
    store,
    evaluate(input: Omit<RateLimitEvaluateInput, 'nowMs'>): QuotaDecision {
      return evaluateQuota({ ...input, nowMs: now() }, { ...options, store });
    },
    release(key: string): void {
      releaseConcurrency(store, key, now());
    },
  };
}

function mergePolicyMatrix(
  overrides?: Partial<Record<EndpointClass, Partial<Record<RateLimitSubject, EndpointQuotaPolicy>>>>,
): Record<EndpointClass, Record<RateLimitSubject, EndpointQuotaPolicy>> {
  if (!overrides) {
    return DEFAULT_ENDPOINT_QUOTA_MATRIX;
  }
  const merged = structuredClone(DEFAULT_ENDPOINT_QUOTA_MATRIX);
  for (const endpoint of endpointClasses) {
    const subjectOverrides = overrides[endpoint];
    if (!subjectOverrides) {
      continue;
    }
    for (const subject of rateLimitSubjects) {
      const override = subjectOverrides[subject];
      if (override) {
        merged[endpoint][subject] = override;
      }
    }
  }
  return merged;
}

/** Validates matrix ordering: anonymous < authenticated < admin < service. */
export function assertSubjectQuotaOrdering(
  matrix: Record<EndpointClass, Record<RateLimitSubject, EndpointQuotaPolicy>> = DEFAULT_ENDPOINT_QUOTA_MATRIX,
): void {
  for (const endpointClass of endpointClasses) {
    const anon = resolveEndpointPolicy(matrix, endpointClass, 'anonymous');
    const auth = resolveEndpointPolicy(matrix, endpointClass, 'authenticated');
    const admin = resolveEndpointPolicy(matrix, endpointClass, 'admin');
    const service = resolveEndpointPolicy(matrix, endpointClass, 'service');

    if (!(anon.dailyCap <= auth.dailyCap && auth.dailyCap <= admin.dailyCap && admin.dailyCap <= service.dailyCap)) {
      throw new Error(`daily cap ordering violated for ${endpointClass}`);
    }
    if (
      !(
        anon.windowCap <= auth.windowCap &&
        auth.windowCap <= admin.windowCap &&
        admin.windowCap <= service.windowCap
      )
    ) {
      throw new Error(`window cap ordering violated for ${endpointClass}`);
    }
    if (!(SUBJECT_ORDER.anonymous < SUBJECT_ORDER.authenticated)) {
      throw new Error('subject ordering misconfigured');
    }
  }
}

export type DistributedRiskAggregation = {
  readonly totalScore: number;
  readonly byKind: Readonly<Partial<Record<RiskSignalKind, number>>>;
  readonly distinctDimensions: number;
  readonly exceedsThreshold: boolean;
};

/** Aggregates cross-dimension risk for distributed abuse beyond a single IP. */
export function aggregateDistributedRisk(
  signals: readonly RiskSignal[],
  nowMs: number,
  threshold = 12,
): DistributedRiskAggregation {
  const windowMs = 300_000;
  const byKind: Partial<Record<RiskSignalKind, number>> = {};
  const dimensions = new Set<string>();
  let totalScore = 0;

  for (const signal of signals) {
    if (nowMs - signal.observedAtMs > windowMs) {
      continue;
    }
    totalScore += Math.max(0, signal.weight);
    byKind[signal.kind] = (byKind[signal.kind] ?? 0) + signal.weight;
    if (signal.dimension) {
      dimensions.add(`${signal.kind}:${signal.dimension}`);
    }
  }

  return {
    totalScore,
    byKind,
    distinctDimensions: dimensions.size,
    exceedsThreshold: totalScore >= threshold,
  };
}
