/**
 * Tests for cost and resource exhaustion controls.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertAllServicesBounded,
  assertRetryPoliciesBounded,
  assertShutdownOrdering,
  BB022_APP_HOSTING_LIMITS,
  BB025_POLICY_REF,
  computeRetryDelay,
  DEFAULT_CLOUD_RUN_JOB_POLICIES,
  DEFAULT_CLOUD_TASKS_POLICIES,
  DEFAULT_DAILY_BUDGETS,
  DEFAULT_SERVICE_SCALING_LIMITS,
  DEFAULT_SOFT_SHUTDOWN_POLICY,
  evaluateCircuitBreaker,
  evaluateDailyBudget,
  evaluateDatabaseAcquire,
  evaluateQueueDispatch,
  evaluateScalingCap,
  evaluateSoftShutdown,
  isRetryBudgetExhausted,
  recordCircuitFailure,
  RESOURCE_CONTROL_POLICY_VERSION,
  simulateAbusiveTrafficPattern,
} from './resource-controls.ts';

test('every service has conservative bounded maxInstances', () => {
  assertAllServicesBounded();
  for (const row of Object.values(DEFAULT_SERVICE_SCALING_LIMITS)) {
    assert.ok(row.maxInstances <= 100, `${row.serviceId} maxInstances must be conservative`);
  }
});

test('web scaling uses Vercel soft planning caps', () => {
  const web = DEFAULT_SERVICE_SCALING_LIMITS.web;
  assert.equal(web.runtime, 'vercel');
  assert.equal(web.minInstances, BB022_APP_HOSTING_LIMITS.production.minInstances);
  assert.equal(web.maxInstances, BB022_APP_HOSTING_LIMITS.production.maxInstances);
  assert.equal(web.concurrency, BB022_APP_HOSTING_LIMITS.production.concurrency);
  assert.equal(web.minInstances, 0, 'Vercel has no warm minInstances');
  assert.equal(web.bb022Ref, 'docs/runbooks/vercel-public-web-cutover.md');
});

test('references  rate limit policy version without rewriting quotas', () => {
  assert.equal(typeof BB025_POLICY_REF, 'string');
  assert.match(BB025_POLICY_REF, /^\d+\.\d+\.\d+$/);
});

test('retry delay uses capped exponential backoff', () => {
  const policy = DEFAULT_CLOUD_TASKS_POLICIES['submissions-intake'].retry;
  assert.equal(computeRetryDelay(1, policy), policy.initialBackoffMs);
  const delay3 = computeRetryDelay(3, policy);
  assert.ok(delay3 > policy.initialBackoffMs);
  const delayMax = computeRetryDelay(100, policy);
  assert.equal(delayMax, policy.maxBackoffMs);
  assert.equal(isRetryBudgetExhausted(policy.maxAttempts, policy), true);
  assert.equal(isRetryBudgetExhausted(policy.maxAttempts - 1, policy), false);
});

test('assertRetryPoliciesBounded validates all queues and jobs', () => {
  assertRetryPoliciesBounded();
});

test('scaling cap denies unbounded scale-out (fail closed)', () => {
  const allowed = evaluateScalingCap({ serviceId: 'api-public', requestedInstances: 4 });
  assert.equal(allowed.allowed, true);

  const denied = evaluateScalingCap({ serviceId: 'api-public', requestedInstances: 999 });
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.reason, 'scaling_cap_exceeded');
    assert.equal(denied.failClosed, true);
  }
});

test('queue dispatch enforces rate, concurrency, and retry budget', () => {
  const policy = DEFAULT_CLOUD_TASKS_POLICIES['research-campaign'];
  const allowed = evaluateQueueDispatch({
    queueId: 'research-campaign',
    dispatchesThisSecond: 0,
    activeDispatches: 0,
    queueDepth: 0,
    attempt: 1,
  });
  assert.equal(allowed.allowed, true);

  const rateDenied = evaluateQueueDispatch({
    queueId: 'research-campaign',
    dispatchesThisSecond: policy.maxDispatchesPerSecond + 1,
    activeDispatches: 0,
    queueDepth: 0,
    attempt: 1,
  });
  assert.equal(rateDenied.allowed, false);

  const retryDenied = evaluateQueueDispatch({
    queueId: 'research-campaign',
    dispatchesThisSecond: 0,
    activeDispatches: 0,
    queueDepth: 0,
    attempt: policy.maxAttempts,
  });
  assert.equal(retryDenied.allowed, false);
  if (!retryDenied.allowed) {
    assert.equal(retryDenied.reason, 'retry_budget_exhausted');
  }
});

test('database acquire fails closed on connection exhaustion', () => {
  const limits = DEFAULT_SERVICE_SCALING_LIMITS;
  assert.ok(limits);

  const allowed = evaluateDatabaseAcquire({
    role: 'role_public_read',
    activeConnections: 5,
  });
  assert.equal(allowed.allowed, true);

  const denied = evaluateDatabaseAcquire({
    role: 'role_public_read',
    activeConnections: 10,
  });
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.reason, 'database_connection_exhausted');
    assert.equal(denied.failClosed, true);
  }

  const timeoutDenied = evaluateDatabaseAcquire({
    role: 'role_public_read',
    activeConnections: 1,
    statementElapsedMs: 10_000,
  });
  assert.equal(timeoutDenied.allowed, false);
  if (!timeoutDenied.allowed) {
    assert.equal(timeoutDenied.reason, 'statement_timeout');
  }
});

test('daily budget pairs alerts with automated responses', () => {
  const soft = evaluateDailyBudget({
    category: 'geocoder',
    consumed: Math.floor(DEFAULT_DAILY_BUDGETS.geocoder.dailyCap * 0.85),
  });
  assert.equal(soft.softShutdownTriggered, true);
  assert.equal(soft.hardStopTriggered, false);
  assert.ok(soft.automatedResponse);

  const hard = evaluateDailyBudget({
    category: 'geocoder',
    consumed: DEFAULT_DAILY_BUDGETS.geocoder.dailyCap,
  });
  assert.equal(hard.hardStopTriggered, true);
  assert.equal(hard.allowed, false);
  if (!hard.allowed) {
    assert.equal(hard.automatedResponse, 'disable_geocoder');
  }
});

test('optional research stops before public serving under soft shutdown', () => {
  assertShutdownOrdering();

  const researchDenied = evaluateSoftShutdown({
    tier: 'optional_research',
    budgetPercentUsed: 75,
  });
  assert.equal(researchDenied.allowed, false);

  const publicAllowed = evaluateSoftShutdown({
    tier: 'public_serving',
    budgetPercentUsed: 99,
  });
  assert.equal(publicAllowed.allowed, true);

  assert.equal(DEFAULT_SOFT_SHUTDOWN_POLICY.autoDisablePublicCorpus, false);
});

test('circuit breaker opens after failures and fail closed while open', () => {
  const config = { failureThreshold: 3, recoveryTimeoutMs: 60_000, halfOpenMaxAttempts: 1 };
  let snapshot = { state: 'closed' as const, failureCount: 0, halfOpenAttempts: 0 };
  const now = 1_700_000_000_000;

  snapshot = recordCircuitFailure(snapshot, config, now);
  snapshot = recordCircuitFailure(snapshot, config, now);
  snapshot = recordCircuitFailure(snapshot, config, now);

  const { decision, next } = evaluateCircuitBreaker(snapshot, config, now);
  assert.equal(next.state, 'open');
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, 'circuit_breaker_open');
  }
});

test('simulateAbusiveTrafficPattern validates spike containment', () => {
  const result = simulateAbusiveTrafficPattern([
    { serviceId: 'web', requestedInstances: 100 },
    { serviceId: 'api-public', requestedInstances: 50 },
    { serviceId: 'api-public', requestedInstances: 8 },
    {
      serviceId: 'api-public',
      requestedInstances: 1,
      queueId: 'research-campaign',
      dispatchesPerSecond: 100,
    },
    {
      serviceId: 'web',
      requestedInstances: 1,
      category: 'research_campaign',
      budgetConsumed: DEFAULT_DAILY_BUDGETS.research_campaign.dailyCap,
    },
  ]);

  assert.ok(result.scalingDenials >= 2);
  assert.ok(result.budgetHardStops >= 1);
  assert.ok(result.researchSoftShutdowns >= 1);
  assert.equal(result.publicServingPreserved, true);
  assert.equal(result.maxObservedInstances.web, DEFAULT_SERVICE_SCALING_LIMITS.web.maxInstances);
  assert.equal(
    result.maxObservedInstances['api-public'],
    DEFAULT_SERVICE_SCALING_LIMITS['api-public'].maxInstances,
  );
});

test('cloud run jobs have CPU, memory, duration, and retry limits', () => {
  for (const job of Object.values(DEFAULT_CLOUD_RUN_JOB_POLICIES)) {
    assert.ok(job.cpu >= 1);
    assert.ok(job.memoryMiB >= 512);
    assert.ok(job.maxDurationSec > 0);
    assert.ok(job.maxRetries >= 0);
    assert.ok(job.retry.maxAttempts >= 1);
  }
});

test('policy version is semver', () => {
  assert.match(RESOURCE_CONTROL_POLICY_VERSION, /^\d+\.\d+\.\d+$/);
});
