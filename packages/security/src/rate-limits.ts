/**
 * Endpoint rate limits and abuse quotas.
 *
 * Pure deterministic policy matrix + token-bucket evaluator with bounded in-memory
 * state. Layered controls: subject quotas, endpoint classes, rolling/daily windows,
 * concurrency caps, and distributed risk-signal aggregation. No external store dependency.
 *
 * App Check outage carve-out (repo-uqmm; ADR-020 §3, threat-model T2).
 * App Check is attestation, never authorization: it only shapes abuse cost. During
 * NORMAL operation an unattested `anonymous` caller is hard-denied `app_check_required`
 * on `expensive_read`/`mutation` tiers — this is the enumeration/abuse defense and it
 * stays, because relaxing it unconditionally would make expensive search free
 * enumeration for any tokenless caller. The genuine gap T2 names is a *confirmed
 * App Check service outage* (verifier/provider down), where even legitimate clients
 * cannot attest and a hard-deny becomes a self-inflicted availability outage. The
 * evaluator distinguishes the two via an explicit `appCheckAvailability` signal: only
 * when it is `'outage'` does the hard-deny relax — and it relaxes to a BOUNDED DEGRADED
 * quota (`deriveOutageDegradedPolicy`), never to free access. Static reads never hit the
 * hard-deny and so fail open in every mode. `risk_score_exceeded` still fails closed on
 * a genuine abuse spike even during an outage (abuse signal, not mere absence of a
 * token). The outage signal is an operator/circuit input (see apps/api-public wiring);
 * a single unverified request is NOT an outage.
 */

/** Caller identity tier anonymous receives the smallest quota. */
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

/**
 * App Check service availability, as seen by the server.
 *
 * `available` (default): normal operation — attestation is reachable, so an unattested
 * expensive/mutation request from an `anonymous` caller is a policy choice by that caller
 * and is hard-denied.
 *
 * `outage`: the App Check verifier/provider is confirmed unreachable (operator-set flag or
 * a verification circuit breaker). Even honest clients cannot attest, so the hard-deny
 * relaxes to a bounded degraded quota rather than locking the public corpus (T2 fail-open).
 */
export type AppCheckAvailability = 'available' | 'outage';

export const appCheckAvailabilityStates = [
  'available',
  'outage',
] as const satisfies readonly AppCheckAvailability[];

export type QuotaDecisionAllowed = {
  readonly allowed: true;
  readonly remaining: number;
  readonly resetAtMs: number;
  readonly concurrencyRemaining: number;
  readonly policyVersion: string;
  /** True when served under the App Check outage degraded-quota carve-out (observability/T2). */
  readonly degraded?: boolean;
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
  /** Cost tier for documentation ordering checks. */
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
  /**
   * Confirmed App Check service availability. Defaults to `'available'`. Set to `'outage'`
   * ONLY on a systemic outage signal (operator flag / verification circuit breaker), never
   * per single unverified request. Under `'outage'`, unattested expensive/mutation reads for
   * `anonymous` callers degrade to a bounded quota instead of a hard `app_check_required` deny.
   */
  readonly appCheckAvailability?: AppCheckAvailability;
  /** Parseable `X-BlackStory-Client` header from a direct API caller (mobile). */
  readonly clientAttested?: boolean;
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

/** Default quota matrix expensive endpoints are stricter than static reads. */
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
    // Explore Place search + /locate share this class; anonymous needs headroom for
    // a few retries without tripping before Census responds. Still well under static reads.
    // Keep maxConcurrency at 1 for anonymous to limit parallel geocoder abuse.
    anonymous: policy(20, 0.4, 20, 60_000, 120, 1, 'expensive_read'),
    authenticated: policy(40, 0.8, 40, 60_000, 300, 3, 'expensive_read'),
    admin: policy(60, 1.2, 60, 60_000, 600, 5, 'expensive_read'),
    service: policy(120, 2.5, 120, 60_000, 2_000, 10, 'expensive_read'),
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

/**
 * Fraction of the normal quota an unattested expensive/mutation caller keeps during a
 * confirmed App Check outage. Deliberately small (quarter) so degraded-mode access is
 * clearly bounded — fail-open for availability must not become free enumeration. Every
 * cap floors at 1 so the tier stays usable but minimal.
 */
export const OUTAGE_DEGRADED_QUOTA_FACTOR = 0.25 as const;

/**
 * Derive the bounded degraded quota applied to unattested `expensive_read`/`mutation`
 * requests during a confirmed App Check outage. Shrinks burst/window/daily caps by
 * `factor` (floored at 1) and clamps concurrency to a single in-flight request, so the
 * outage carve-out is strictly stricter than the normal attested-anonymous quota and can
 * never exceed it. Pure and deterministic.
 */
export function deriveOutageDegradedPolicy(
  policyRow: EndpointQuotaPolicy,
  factor: number = OUTAGE_DEGRADED_QUOTA_FACTOR,
): EndpointQuotaPolicy {
  const shrink = (value: number): number => Math.max(1, Math.floor(value * factor));
  return {
    ...policyRow,
    capacity: shrink(policyRow.capacity),
    refillPerSec: policyRow.refillPerSec * factor,
    windowCap: shrink(policyRow.windowCap),
    dailyCap: shrink(policyRow.dailyCap),
    maxConcurrency: 1,
  };
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

function refillTokens(
  state: TokenBucketState,
  policyRow: EndpointQuotaPolicy,
  nowMs: number,
): void {
  const elapsedSec = Math.max(0, (nowMs - state.lastRefillMs) / 1000);
  if (elapsedSec <= 0) {
    return;
  }
  state.tokens = Math.min(policyRow.capacity, state.tokens + elapsedSec * policyRow.refillPerSec);
  state.lastRefillMs = nowMs;
}

function resetWindowsIfNeeded(
  state: TokenBucketState,
  policyRow: EndpointQuotaPolicy,
  nowMs: number,
): void {
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

export function aggregateRiskScore(
  signals: readonly RiskSignal[] | undefined,
  nowMs: number,
): number {
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
  const identity = parts.userId ?? parts.deviceId ?? parts.sessionId ?? parts.clientIp ?? 'unknown';
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
  matrix: Record<
    EndpointClass,
    Record<RateLimitSubject, EndpointQuotaPolicy>
  > = DEFAULT_ENDPOINT_QUOTA_MATRIX,
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
  matrix: Record<
    EndpointClass,
    Record<RateLimitSubject, EndpointQuotaPolicy>
  > = DEFAULT_ENDPOINT_QUOTA_MATRIX,
): boolean {
  const expensive = resolveEndpointPolicy(matrix, endpointClass, subject);
  const staticRead = resolveEndpointPolicy(matrix, 'entityRetrieval', subject);
  return expensive.windowCap < staticRead.windowCap && expensive.dailyCap < staticRead.dailyCap;
}

function deny(reason: QuotaDenialReason, retryAfterMs: number): QuotaDecisionDenied {
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
  degraded = false,
): QuotaDecisionAllowed {
  return {
    allowed: true,
    remaining,
    resetAtMs,
    concurrencyRemaining,
    policyVersion: RATE_LIMIT_POLICY_VERSION,
    ...(degraded ? { degraded: true } : {}),
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
  const outage = input.appCheckAvailability === 'outage';

  // Endpoints with a zero base quota (e.g. anonymous admin tiers) always deny, regardless of
  // attestation or outage — the outage carve-out only relaxes attestation, never a real cap.
  if (policyRow.capacity <= 0 || policyRow.dailyCap <= 0) {
    return deny('daily_cap_exceeded', policyRow.windowMs);
  }

  // A genuine abuse spike fails closed even during an outage: this is an abuse SIGNAL crossing
  // threshold, not the mere absence of a token (T2 "fail closed only on a specific abuse signal").
  const riskScore = aggregateRiskScore(input.riskSignals, nowMs);
  if (riskScore >= riskThreshold) {
    return deny('risk_score_exceeded', 60_000);
  }

  const unattestedExpensiveAnon =
    input.subject === 'anonymous' &&
    !input.appCheckVerified &&
    !input.clientAttested &&
    (policyRow.costTier === 'expensive_read' || policyRow.costTier === 'mutation');

  // Normal operation: unattested expensive/mutation reads are hard-denied (enumeration defense).
  // Confirmed outage: skip the hard-deny and serve under a bounded degraded quota instead.
  if (unattestedExpensiveAnon && !outage) {
    return deny('app_check_required', 30_000);
  }

  // A widespread `missing_app_check` signal is expected during an outage; only treat it as a hard
  // deny under normal operation. Under outage we rely on the risk-score threshold above + degraded
  // quota below rather than denying every honest-but-unattested caller.
  if (
    !outage &&
    input.appCheckVerified === false &&
    input.clientAttested !== true &&
    input.riskSignals?.some((s) => s.kind === 'missing_app_check')
  ) {
    return deny('app_check_required', 30_000);
  }

  const degraded = outage && unattestedExpensiveAnon;
  const effectivePolicy = degraded ? deriveOutageDegradedPolicy(policyRow) : policyRow;

  let state = store.get(input.key, nowMs);
  if (!state) {
    state = createInitialBucketState(effectivePolicy, nowMs);
  }

  resetWindowsIfNeeded(state, effectivePolicy, nowMs);
  refillTokens(state, effectivePolicy, nowMs);

  if (state.activeConcurrency >= effectivePolicy.maxConcurrency) {
    store.set(input.key, state, effectivePolicy.windowMs + MS_PER_DAY, nowMs);
    return deny('concurrency_exceeded', 5_000);
  }

  if (state.dailyCount >= effectivePolicy.dailyCap) {
    const retryAfterMs = state.dailyStartMs + MS_PER_DAY - nowMs;
    store.set(input.key, state, effectivePolicy.windowMs + MS_PER_DAY, nowMs);
    return deny('daily_cap_exceeded', retryAfterMs);
  }

  if (state.windowCount >= effectivePolicy.windowCap) {
    const retryAfterMs = state.windowStartMs + effectivePolicy.windowMs - nowMs;
    store.set(input.key, state, effectivePolicy.windowMs + MS_PER_DAY, nowMs);
    return deny('rolling_window_exceeded', retryAfterMs);
  }

  if (state.tokens < 1) {
    const tokensNeeded = 1 - state.tokens;
    const retryAfterMs = Math.ceil((tokensNeeded / effectivePolicy.refillPerSec) * 1000);
    store.set(input.key, state, effectivePolicy.windowMs + MS_PER_DAY, nowMs);
    return deny('token_bucket_exhausted', retryAfterMs);
  }

  if (consume) {
    state.tokens -= 1;
    state.windowCount += 1;
    state.dailyCount += 1;
    state.activeConcurrency += 1;
  }

  const resetAtMs = Math.min(
    state.windowStartMs + effectivePolicy.windowMs,
    state.dailyStartMs + MS_PER_DAY,
  );

  store.set(input.key, state, effectivePolicy.windowMs + MS_PER_DAY, nowMs);

  return allow(
    Math.floor(state.tokens),
    resetAtMs,
    Math.max(0, effectivePolicy.maxConcurrency - state.activeConcurrency),
    degraded,
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
  overrides?: Partial<
    Record<EndpointClass, Partial<Record<RateLimitSubject, EndpointQuotaPolicy>>>
  >,
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
  matrix: Record<
    EndpointClass,
    Record<RateLimitSubject, EndpointQuotaPolicy>
  > = DEFAULT_ENDPOINT_QUOTA_MATRIX,
): void {
  for (const endpointClass of endpointClasses) {
    const anon = resolveEndpointPolicy(matrix, endpointClass, 'anonymous');
    const auth = resolveEndpointPolicy(matrix, endpointClass, 'authenticated');
    const admin = resolveEndpointPolicy(matrix, endpointClass, 'admin');
    const service = resolveEndpointPolicy(matrix, endpointClass, 'service');

    if (!(
      anon.dailyCap <= auth.dailyCap &&
      auth.dailyCap <= admin.dailyCap &&
      admin.dailyCap <= service.dailyCap
    )) {
      throw new Error(`daily cap ordering violated for ${endpointClass}`);
    }
    if (!(
      anon.windowCap <= auth.windowCap &&
      auth.windowCap <= admin.windowCap &&
      admin.windowCap <= service.windowCap
    )) {
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
