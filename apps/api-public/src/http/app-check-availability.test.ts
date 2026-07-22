/**
 * `resolveAppCheckAvailability` / provider tests — env override, circuit breaker, and precedence.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAppCheckCircuitBreaker } from '@repo/firebase';
import {
  APP_CHECK_OUTAGE_OVERRIDE_ENV,
  createAppCheckAvailabilityProvider,
  resolveAppCheckAvailability,
} from './app-check-availability.js';

test('defaults to available with no override set', () => {
  assert.equal(resolveAppCheckAvailability({ environment: {} }), 'available');
});

test('defaults to available for an unrelated/garbage value (never fails open on noise)', () => {
  assert.equal(
    resolveAppCheckAvailability({ environment: { [APP_CHECK_OUTAGE_OVERRIDE_ENV]: 'nope' } }),
    'available',
  );
});

test('flips to outage for "1", "true", or "outage" (case-insensitive)', () => {
  for (const value of ['1', 'true', 'TRUE', 'outage', 'Outage']) {
    assert.equal(
      resolveAppCheckAvailability({ environment: { [APP_CHECK_OUTAGE_OVERRIDE_ENV]: value } }),
      'outage',
      `expected "${value}" to resolve to outage`,
    );
  }
});

test('provider samples the environment fresh on every call (operator flip takes effect live)', () => {
  const environment: Record<string, string | undefined> = {};
  const provider = createAppCheckAvailabilityProvider({ environment });

  assert.equal(provider(), 'available');
  environment[APP_CHECK_OUTAGE_OVERRIDE_ENV] = '1';
  assert.equal(provider(), 'outage');
  delete environment[APP_CHECK_OUTAGE_OVERRIDE_ENV];
  assert.equal(provider(), 'available');
});

test('manual APP_CHECK_OUTAGE_OVERRIDE wins over a closed circuit breaker', () => {
  const breaker = createAppCheckCircuitBreaker();
  assert.equal(
    resolveAppCheckAvailability({
      environment: { [APP_CHECK_OUTAGE_OVERRIDE_ENV]: 'outage' },
      circuitBreaker: breaker,
    }),
    'outage',
  );
  assert.equal(breaker.getAvailability(), 'available');
});

test('circuit breaker flips availability to outage on sustained verifier failures', () => {
  const breaker = createAppCheckCircuitBreaker({
    config: { failureThreshold: 2, windowMs: 60_000, recoveryTimeoutMs: 30_000, halfOpenSuccessThreshold: 1 },
  });
  const provider = createAppCheckAvailabilityProvider({ environment: {}, circuitBreaker: breaker });

  assert.equal(provider(), 'available');
  breaker.recordVerifierFailure();
  assert.equal(provider(), 'available');
  breaker.recordVerifierFailure();
  assert.equal(provider(), 'outage');
});

test('simulated verifier outage pattern flips provider to outage and back on recovery', () => {
  const breaker = createAppCheckCircuitBreaker({
    config: { failureThreshold: 2, windowMs: 60_000, recoveryTimeoutMs: 1_000, halfOpenSuccessThreshold: 1 },
    now: () => 5_000,
  });
  const provider = createAppCheckAvailabilityProvider({ environment: {}, circuitBreaker: breaker });

  breaker.recordVerifierFailure(0);
  breaker.recordVerifierFailure(1);
  assert.equal(provider(), 'outage');

  breaker.getAvailability(2_000);
  breaker.recordVerifierSuccess(2_001);
  assert.equal(provider(), 'available');
});
