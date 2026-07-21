/**
 * Tests for endpoint rate limits and abuse quotas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateDistributedRisk,
  assertSubjectQuotaOrdering,
  buildRateLimitKey,
  compareSubjectQuota,
  createInMemoryRateLimitStore,
  createRateLimitEvaluator,
  DEFAULT_ENDPOINT_QUOTA_MATRIX,
  deriveOutageDegradedPolicy,
  evaluateQuota,
  formatRateLimitResponse,
  isExpensiveEndpointStricter,
  OUTAGE_DEGRADED_QUOTA_FACTOR,
  releaseConcurrency,
  resolveEndpointPolicy,
  safeRetryAfter,
  type RiskSignal,
} from './rate-limits.ts';

test('anonymous receives smallest quota for every endpoint class', () => {
  assertSubjectQuotaOrdering();
  for (const endpointClass of Object.keys(DEFAULT_ENDPOINT_QUOTA_MATRIX) as Array<
    keyof typeof DEFAULT_ENDPOINT_QUOTA_MATRIX
  >) {
    assert.ok(
      compareSubjectQuota(endpointClass, 'anonymous', 'authenticated') < 0,
      `${endpointClass}: anonymous < authenticated`,
    );
    assert.ok(
      compareSubjectQuota(endpointClass, 'authenticated', 'admin') <= 0,
      `${endpointClass}: authenticated <= admin`,
    );
  }
});

test('expensive endpoints are stricter than static entity reads', () => {
  assert.equal(isExpensiveEndpointStricter('search'), true);
  assert.equal(isExpensiveEndpointStricter('geocoding'), true);
  assert.equal(isExpensiveEndpointStricter('nearbyDiscovery'), true);
  assert.equal(isExpensiveEndpointStricter('entityRetrieval'), false);
});

test('token bucket allows burst then denies without revealing exact threshold', () => {
  const store = createInMemoryRateLimitStore({ maxKeys: 100 });
  const key = buildRateLimitKey({
    subject: 'anonymous',
    endpointClass: 'search',
    clientIp: '203.0.113.10',
  });
  const policy = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'search', 'anonymous');
  const nowMs = 1_700_000_000_000;

  let lastDecision = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'search',
      key,
      nowMs,
      consume: true,
      appCheckVerified: true,
    },
    { store },
  );
  assert.equal(lastDecision.allowed, true);
  releaseConcurrency(store, key, nowMs);

  for (let i = 1; i < policy.windowCap; i += 1) {
    const at = nowMs + i;
    lastDecision = evaluateQuota(
      {
        subject: 'anonymous',
        endpointClass: 'search',
        key,
        nowMs: at,
        consume: true,
        appCheckVerified: true,
      },
      { store },
    );
    assert.equal(lastDecision.allowed, true, `request ${i} should be allowed`);
    releaseConcurrency(store, key, at);
  }

  const denied = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'search',
      key,
      nowMs: nowMs + policy.windowCap,
      consume: true,
      appCheckVerified: true,
    },
    { store },
  );
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.ok(denied.safeRetryAfterSec >= 5);
    const http = formatRateLimitResponse(denied);
    assert.equal(http.status, 429);
    assert.equal(http.headers['Retry-After'], String(denied.safeRetryAfterSec));
    assert.equal(http.body.error, 'rate_limit_exceeded');
    assert.ok(!JSON.stringify(http.body).includes(String(policy.windowCap)));
  }
});

test('safeRetryAfter rounds up to coarse intervals', () => {
  assert.equal(safeRetryAfter(500), 5);
  assert.equal(safeRetryAfter(4_500), 5);
  assert.equal(safeRetryAfter(5_100), 10);
  assert.equal(safeRetryAfter(12_000), 15);
});

test('concurrency limit denies when in-flight cap reached', () => {
  const store = createInMemoryRateLimitStore();
  const key = buildRateLimitKey({
    subject: 'anonymous',
    endpointClass: 'geocoding',
    clientIp: '198.51.100.4',
  });
  const nowMs = 1_700_000_100_000;

  const first = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'geocoding',
      key,
      nowMs,
      consume: true,
      appCheckVerified: true,
    },
    { store },
  );
  assert.equal(first.allowed, true);

  const second = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'geocoding',
      key,
      nowMs: nowMs + 1,
      consume: true,
      appCheckVerified: true,
    },
    { store },
  );
  assert.equal(second.allowed, false);
  if (!second.allowed) {
    assert.equal(second.reason, 'concurrency_exceeded');
  }

  releaseConcurrency(store, key, nowMs + 2);
  const third = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'geocoding',
      key,
      nowMs: nowMs + 3,
      consume: true,
      appCheckVerified: true,
    },
    { store },
  );
  assert.equal(third.allowed, true);
});

test('clientAttested satisfies expensive-read trust without App Check', () => {
  const decision = evaluateQuota({
    subject: 'anonymous',
    endpointClass: 'search',
    key: 'anon:search:client',
    nowMs: 1_700_000_205_000,
    appCheckVerified: false,
    clientAttested: true,
  });
  assert.equal(decision.allowed, true);
});

test('missing App Check blocks anonymous expensive endpoints', () => {
  const decision = evaluateQuota({
    subject: 'anonymous',
    endpointClass: 'search',
    key: 'anon:search:test',
    nowMs: 1_700_000_200_000,
    appCheckVerified: false,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'app_check_required');
  }
});

test('mobile client attestation satisfies expensive-read trust without App Check', () => {
  const decision = evaluateQuota({
    subject: 'anonymous',
    endpointClass: 'search',
    key: 'anon:search:client-attested',
    nowMs: 1_700_000_205_000,
    appCheckVerified: false,
    clientAttested: true,
  });
  assert.equal(decision.allowed, true);
});

test('explicit appCheckAvailability=available preserves the hard-deny (enumeration defense)', () => {
  const decision = evaluateQuota({
    subject: 'anonymous',
    endpointClass: 'search',
    key: 'anon:search:available',
    nowMs: 1_700_000_210_000,
    appCheckVerified: false,
    appCheckAvailability: 'available',
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'app_check_required');
  }
});

test('App Check OUTAGE degrades unattested anonymous search to a bounded quota (fail-open, T2)', () => {
  const store = createInMemoryRateLimitStore({ maxKeys: 100 });
  const key = 'anon:search:outage';
  const nowMs = 1_700_000_220_000;

  const first = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'search',
      key,
      nowMs,
      consume: true,
      appCheckVerified: false,
      appCheckAvailability: 'outage',
    },
    { store },
  );
  // Would be `app_check_required` in normal operation; the outage carve-out serves it instead.
  assert.equal(first.allowed, true);
  if (first.allowed) {
    assert.equal(first.degraded, true, 'served request must be flagged degraded for observability');
  }
});

test('App Check OUTAGE search is BOUNDED — degraded quota still exhausts (not free enumeration)', () => {
  const store = createInMemoryRateLimitStore({ maxKeys: 100 });
  const key = 'anon:search:outage-bounded';
  const nowMs = 1_700_000_230_000;
  const degraded = deriveOutageDegradedPolicy(
    resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'search', 'anonymous'),
  );

  let allowedCount = 0;
  let deniedDecision: ReturnType<typeof evaluateQuota> | null = null;
  // Concurrency for degraded is clamped to 1, so release between calls to probe the token/window caps.
  for (let i = 0; i < degraded.windowCap + 5; i += 1) {
    const at = nowMs + i;
    const decision = evaluateQuota(
      {
        subject: 'anonymous',
        endpointClass: 'search',
        key,
        nowMs: at,
        consume: true,
        appCheckVerified: false,
        appCheckAvailability: 'outage',
      },
      { store },
    );
    if (decision.allowed) {
      allowedCount += 1;
      releaseConcurrency(store, key, at);
    } else {
      deniedDecision = decision;
      break;
    }
  }

  assert.ok(deniedDecision, 'degraded outage quota must eventually deny — access is bounded, not free');
  assert.ok(
    allowedCount <= degraded.capacity,
    `degraded burst (${allowedCount}) must not exceed degraded capacity (${degraded.capacity})`,
  );
});

test('App Check OUTAGE still fails CLOSED on a genuine abuse spike (risk score)', () => {
  const nowMs = 1_700_000_240_000;
  const signals: RiskSignal[] = [
    { kind: 'ip_burst', weight: 6, observedAtMs: nowMs - 1_000, dimension: '203.0.113.9' },
    { kind: 'device_burst', weight: 8, observedAtMs: nowMs - 2_000, dimension: 'dev-x' },
  ];
  const decision = evaluateQuota(
    {
      subject: 'anonymous',
      endpointClass: 'search',
      key: 'anon:search:outage-abuse',
      nowMs,
      appCheckVerified: false,
      appCheckAvailability: 'outage',
      riskSignals: signals,
    },
    { riskScoreThreshold: 12 },
  );
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'risk_score_exceeded');
  }
});

test('App Check OUTAGE does not degrade attested callers — they keep the full quota', () => {
  const decision = evaluateQuota({
    subject: 'anonymous',
    endpointClass: 'search',
    key: 'anon:search:outage-attested',
    nowMs: 1_700_000_250_000,
    appCheckVerified: true,
    appCheckAvailability: 'outage',
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.notEqual(decision.degraded, true, 'attested caller is not degraded');
  }
});

test('App Check OUTAGE leaves static reads fully open and undegraded', () => {
  const decision = evaluateQuota({
    subject: 'anonymous',
    endpointClass: 'entityRetrieval',
    key: 'anon:entity:outage',
    nowMs: 1_700_000_260_000,
    appCheckVerified: false,
    appCheckAvailability: 'outage',
  });
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.notEqual(decision.degraded, true, 'static reads never hit the degraded carve-out');
  }
});

test('deriveOutageDegradedPolicy is strictly bounded, floored at 1, and single-concurrency', () => {
  for (const endpointClass of ['search', 'geocoding', 'nearbyDiscovery', 'corrections'] as const) {
    const base = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, endpointClass, 'anonymous');
    const degraded = deriveOutageDegradedPolicy(base);
    assert.ok(degraded.capacity >= 1 && degraded.capacity <= base.capacity, `${endpointClass} capacity`);
    assert.ok(degraded.windowCap >= 1 && degraded.windowCap <= base.windowCap, `${endpointClass} windowCap`);
    assert.ok(degraded.dailyCap >= 1 && degraded.dailyCap <= base.dailyCap, `${endpointClass} dailyCap`);
    assert.equal(degraded.maxConcurrency, 1, `${endpointClass} concurrency clamped`);
    assert.ok(degraded.refillPerSec <= base.refillPerSec, `${endpointClass} refill`);
    assert.equal(degraded.costTier, base.costTier, `${endpointClass} cost tier preserved`);
  }
  assert.ok(OUTAGE_DEGRADED_QUOTA_FACTOR > 0 && OUTAGE_DEGRADED_QUOTA_FACTOR < 1);
});

test('distributed risk aggregation detects abuse beyond single IP', () => {
  const nowMs = 1_700_000_300_000;
  const signals: RiskSignal[] = [
    { kind: 'ip_burst', weight: 2, observedAtMs: nowMs - 1_000, dimension: '203.0.113.1' },
    { kind: 'device_burst', weight: 4, observedAtMs: nowMs - 2_000, dimension: 'dev-a' },
    { kind: 'session_burst', weight: 3, observedAtMs: nowMs - 3_000, dimension: 'sess-b' },
    { kind: 'account_rotation', weight: 5, observedAtMs: nowMs - 4_000, dimension: 'cluster-1' },
  ];

  const agg = aggregateDistributedRisk(signals, nowMs, 12);
  assert.equal(agg.exceedsThreshold, true);
  assert.equal(agg.distinctDimensions, 4);
  assert.ok((agg.byKind.device_burst ?? 0) >= 4);

  const denied = evaluateQuota(
    {
      subject: 'authenticated',
      endpointClass: 'search',
      key: 'auth:search:user-1',
      nowMs,
      riskSignals: signals,
      appCheckVerified: true,
    },
    { riskScoreThreshold: 12 },
  );
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.reason, 'risk_score_exceeded');
  }
});

test('in-memory store is bounded by maxKeys with TTL expiry', () => {
  const store = createInMemoryRateLimitStore({ maxKeys: 2, defaultTtlMs: 1_000 });
  const t0 = 1_700_000_400_000;

  store.set('a', createEmptyState(), 500, t0);
  store.set('b', createEmptyState(), 500, t0);
  store.set('c', createEmptyState(), 500, t0);

  assert.ok(store.size() <= 2);
  assert.equal(store.get('a', t0 + 2_000), undefined);
});

test('evaluator wrapper supports evaluate and release', () => {
  const evaluator = createRateLimitEvaluator({ now: () => 1_700_000_500_000 });
  const key = buildRateLimitKey({
    subject: 'authenticated',
    endpointClass: 'entityRetrieval',
    userId: 'user-42',
  });

  const allowed = evaluator.evaluate({
    subject: 'authenticated',
    endpointClass: 'entityRetrieval',
    key,
    appCheckVerified: true,
  });
  assert.equal(allowed.allowed, true);
  evaluator.release(key);
});

function createEmptyState() {
  return {
    tokens: 1,
    lastRefillMs: 0,
    windowStartMs: 0,
    windowCount: 0,
    dailyStartMs: 0,
    dailyCount: 0,
    activeConcurrency: 0,
  };
}
