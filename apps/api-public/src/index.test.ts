/**
 * Public API surface acceptance tests (BB-021).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SurfaceCapabilityError,
  deniesCanonicalWrite,
  deniesPublication,
} from '@black-book/config';
import type { AppCheckTelemetryEvent } from '@black-book/firebase';
import { createPublicApiAppCheckGuard } from './app-check.ts';
import { health } from './index.ts';
import { guardMutationAttempt, guardReadOperation } from './posture.ts';

test('health reports api-public surface posture', () => {
  const payload = health();
  assert.equal(payload.service, 'api-public');
  assert.equal(payload.surface, 'api-public');
  assert.equal(payload.networkPosture, 'public-read');
  assert.ok(payload.allowedOperations.includes('read:search'));
  assert.equal(payload.status, 'ok');
});

test('public API denies canonical writes and publication', () => {
  assert.equal(deniesCanonicalWrite('api-public'), true);
  assert.equal(deniesPublication('api-public'), true);
  assert.throws(() => guardMutationAttempt('write:canonical'), SurfaceCapabilityError);
  assert.throws(() => guardMutationAttempt('promote:release'), SurfaceCapabilityError);
});

test('public API allows read operations only', () => {
  assert.doesNotThrow(() => guardReadOperation('read:location'));
});

test('public API App Check guard defaults to monitor mode without token consumption', async () => {
  const events: AppCheckTelemetryEvent[] = [];
  let consumeAppCheckToken = true;
  const guard = createPublicApiAppCheckGuard({
    environment: {},
    verifier: {
      async verifyToken(_token, options) {
        consumeAppCheckToken = options.consumeAppCheckToken;
        return { appId: 'web-app' };
      },
    },
    telemetry: {
      record(event) {
        events.push(event);
      },
    },
  });

  const missing = await guard({ headers: {} });
  const verified = await guard({ headers: { 'x-firebase-appcheck': 'token' } });

  assert.equal(missing.allowed, true);
  assert.equal(missing.verified, false);
  assert.equal(verified.verified, true);
  assert.equal(consumeAppCheckToken, false);
  assert.equal(events[0]?.mode, 'monitor');
});
