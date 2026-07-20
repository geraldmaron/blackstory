/**
 * `resolveAppCheckAvailability` / provider tests — pure env-in/enum-out.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
