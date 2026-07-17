
/**
 * Exercises App Check rollout, replay, trusted-identity, and token-redaction
 * behavior without requiring Firebase network access.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FirebaseApp } from 'firebase/app';
import { configureAppCheckDebugToken, initializeAppCheckScaffold } from './app-check.js';
import {
  createAppCheckGuard,
  type AppCheckTelemetryEvent,
  type AppCheckVerifier,
} from './app-check-enforce.js';

function telemetryCollector() {
  const events: AppCheckTelemetryEvent[] = [];
  return {
    events,
    telemetry: {
      record(event: AppCheckTelemetryEvent) {
        events.push(event);
      },
    },
  };
}

const validVerifier: AppCheckVerifier = {
  async verifyToken() {
    return { appId: 'web-app' };
  },
};

test('monitor mode observes a missing token without rejecting the request', async () => {
  const { events, telemetry } = telemetryCollector();
  const guard = createAppCheckGuard({ mode: 'monitor', verifier: validVerifier, telemetry });

  const decision = await guard({ headers: {} });

  assert.deepEqual(decision, {
    allowed: true,
    verified: false,
    mode: 'monitor',
    trustedService: false,
    reason: 'missing_token',
  });
  assert.equal(events[0]?.outcome, 'monitored_failure');
});

test('enforce mode rejects missing and invalid tokens with a stable response', async () => {
  const { telemetry } = telemetryCollector();
  const invalidVerifier: AppCheckVerifier = {
    async verifyToken() {
      throw new Error('invalid');
    },
  };
  const guard = createAppCheckGuard({
    mode: 'enforce',
    verifier: invalidVerifier,
    telemetry,
  });

  const missing = await guard({ headers: {} });
  const invalid = await guard({ headers: { 'x-firebase-appcheck': 'invalid-token' } });

  assert.equal(missing.allowed, false);
  assert.equal(missing.reason, 'missing_token');
  assert.equal(invalid.allowed, false);
  assert.equal(invalid.reason, 'invalid_token');
  assert.equal(invalid.status, 401);
  assert.equal(invalid.code, 'APP_CHECK_REQUIRED');
});

test('replay protection consumes tokens and rejects a reused token', async () => {
  const { telemetry } = telemetryCollector();
  let consumeRequested = false;
  const verifier: AppCheckVerifier = {
    async verifyToken(_token, options) {
      consumeRequested = options.consumeAppCheckToken;
      return { appId: 'web-app', alreadyConsumed: true };
    },
  };
  const guard = createAppCheckGuard({
    mode: 'enforce',
    verifier,
    telemetry,
    replayProtection: true,
  });

  const decision = await guard({ headers: { 'x-firebase-appcheck': 'replayed-token' } });

  assert.equal(consumeRequested, true);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'replayed_token');
});

test('trusted service identities do not use browser App Check tokens', async () => {
  const { telemetry } = telemetryCollector();
  let verifierCalled = false;
  const verifier: AppCheckVerifier = {
    async verifyToken() {
      verifierCalled = true;
      return { appId: 'unexpected' };
    },
  };
  const guard = createAppCheckGuard({ mode: 'enforce', verifier, telemetry });

  const decision = await guard({
    headers: {},
    identity: {
      kind: 'trusted-service',
      principal: 'service-account',
      verified: true,
    },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.trustedService, true);
  assert.equal(verifierCalled, false);
});

test('verification failures never expose raw tokens to telemetry', async () => {
  const rawToken = 'raw-secret-app-check-token';
  const { events, telemetry } = telemetryCollector();
  const verifier: AppCheckVerifier = {
    async verifyToken(token) {
      throw new Error(`rejected ${token}`);
    },
  };
  const guard = createAppCheckGuard({ mode: 'enforce', verifier, telemetry });

  await guard({ headers: { 'X-Firebase-AppCheck': rawToken } });

  assert.equal(JSON.stringify(events).includes(rawToken), false);
});

test('production rejects App Check debug mode before SDK initialization', () => {
  const target = globalThis as typeof globalThis & {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  };
  target.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  assert.throws(
    () =>
      initializeAppCheckScaffold({} as FirebaseApp, {
        siteKey: 'not-a-secret',
        debugToken: true,
        runtime: 'production',
      }),
    /forbidden in production/,
  );
  assert.equal(target.FIREBASE_APPCHECK_DEBUG_TOKEN, undefined);
});

test('local and test runtimes may configure an ephemeral debug token', () => {
  const target = globalThis as typeof globalThis & {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  };
  try {
    configureAppCheckDebugToken(true, 'test');
    assert.equal(target.FIREBASE_APPCHECK_DEBUG_TOKEN, true);
  } finally {
    delete target.FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
});
