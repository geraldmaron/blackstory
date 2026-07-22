/**
 * Unit tests for the App Check verifier-failure circuit breaker (repo-vdnm).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceAppCheckCircuitBreaker,
  appCheckCircuitBreakerAvailability,
  createAppCheckCircuitBreaker,
  DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG,
  recordAppCheckVerifierFailure,
  recordAppCheckVerifierSuccess,
  type AppCheckCircuitBreakerSnapshot,
  type AppCheckCircuitBreakerTelemetryEvent,
} from './app-check-circuit-breaker.js';

const TEST_CONFIG = {
  failureThreshold: 3,
  windowMs: 10_000,
  recoveryTimeoutMs: 5_000,
  halfOpenSuccessThreshold: 2,
} as const;

const CLOSED: AppCheckCircuitBreakerSnapshot = {
  state: 'closed',
  failureTimestampsMs: [],
  halfOpenSuccesses: 0,
};

test('defaults to available when closed', () => {
  const breaker = createAppCheckCircuitBreaker();
  assert.equal(breaker.getAvailability(), 'available');
});

test('does not open on isolated verifier failures below threshold', () => {
  let snapshot = CLOSED;
  for (let index = 0; index < TEST_CONFIG.failureThreshold - 1; index += 1) {
    snapshot = recordAppCheckVerifierFailure(snapshot, TEST_CONFIG, 1_000 + index);
  }
  assert.equal(snapshot.state, 'closed');
  assert.equal(appCheckCircuitBreakerAvailability(snapshot, TEST_CONFIG, 2_000), 'available');
});

test('opens on sustained verifier failures within the rolling window', () => {
  let snapshot = CLOSED;
  for (let index = 0; index < TEST_CONFIG.failureThreshold; index += 1) {
    snapshot = recordAppCheckVerifierFailure(snapshot, TEST_CONFIG, 1_000 + index);
  }
  assert.equal(snapshot.state, 'open');
  assert.equal(appCheckCircuitBreakerAvailability(snapshot, TEST_CONFIG, 2_000), 'outage');
});

test('expires stale failures outside the rolling window', () => {
  let snapshot = recordAppCheckVerifierFailure(CLOSED, TEST_CONFIG, 0);
  snapshot = recordAppCheckVerifierFailure(snapshot, TEST_CONFIG, 1_000);
  assert.equal(snapshot.state, 'closed');

  snapshot = recordAppCheckVerifierFailure(snapshot, TEST_CONFIG, TEST_CONFIG.windowMs + 2_000);
  assert.equal(snapshot.state, 'closed');
  assert.equal(snapshot.failureTimestampsMs.length, 1);
});

test('transitions open → half-open after recovery timeout', () => {
  const opened = recordAppCheckVerifierFailure(
    recordAppCheckVerifierFailure(
      recordAppCheckVerifierFailure(CLOSED, TEST_CONFIG, 0),
      TEST_CONFIG,
      1,
    ),
    TEST_CONFIG,
    2,
  );
  assert.equal(opened.state, 'open');

  const halfOpen = advanceAppCheckCircuitBreaker(
    opened,
    TEST_CONFIG,
    (opened.openedAtMs ?? 0) + TEST_CONFIG.recoveryTimeoutMs,
  );
  assert.equal(halfOpen.state, 'half_open');
});

test('half-open probe failure reopens the breaker', () => {
  const halfOpen: AppCheckCircuitBreakerSnapshot = {
    state: 'half_open',
    failureTimestampsMs: [],
    halfOpenSuccesses: 0,
  };
  const reopened = recordAppCheckVerifierFailure(halfOpen, TEST_CONFIG, 10_000);
  assert.equal(reopened.state, 'open');
  assert.equal(appCheckCircuitBreakerAvailability(reopened, TEST_CONFIG, 10_000), 'outage');
});

test('half-open consecutive successes close the breaker', () => {
  let snapshot: AppCheckCircuitBreakerSnapshot = {
    state: 'half_open',
    failureTimestampsMs: [],
    halfOpenSuccesses: 0,
  };
  snapshot = recordAppCheckVerifierSuccess(snapshot, TEST_CONFIG, 10_000);
  assert.equal(snapshot.state, 'half_open');
  snapshot = recordAppCheckVerifierSuccess(snapshot, TEST_CONFIG, 10_001);
  assert.equal(snapshot.state, 'closed');
  assert.equal(appCheckCircuitBreakerAvailability(snapshot, TEST_CONFIG, 10_002), 'available');
});

test('createAppCheckCircuitBreaker emits open/close telemetry without token fields', () => {
  const events: AppCheckCircuitBreakerTelemetryEvent[] = [];
  const breaker = createAppCheckCircuitBreaker({
    config: TEST_CONFIG,
    telemetry: {
      record(event) {
        events.push(event);
      },
    },
    now: () => 1_000,
  });

  for (let index = 0; index < TEST_CONFIG.failureThreshold; index += 1) {
    breaker.recordVerifierFailure(1_000 + index);
  }
  assert.equal(events.at(-1)?.transition, 'opened');
  assert.equal(JSON.stringify(events).includes('token'), false);

  breaker.getAvailability((TEST_CONFIG.recoveryTimeoutMs ?? 0) + 2_000);
  breaker.recordVerifierSuccess((TEST_CONFIG.recoveryTimeoutMs ?? 0) + 2_001);
  breaker.recordVerifierSuccess((TEST_CONFIG.recoveryTimeoutMs ?? 0) + 2_002);
  assert.equal(events.at(-1)?.transition, 'closed');
});

test('documented default thresholds match repo-vdnm contract', () => {
  assert.equal(DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.failureThreshold, 5);
  assert.equal(DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.windowMs, 60_000);
  assert.equal(DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.recoveryTimeoutMs, 30_000);
  assert.equal(DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold, 2);
});
