/**
 * Submissions API surface acceptance tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfaceCapabilityError, deniesPublication } from '@repo/config';
import type { AppCheckTelemetryEvent } from '@repo/firebase';
import { createSubmissionsApiAppCheckGuard } from './app-check.ts';
import { health } from './index.ts';
import { guardIntakeOperation, guardPublishAttempt } from './posture.ts';

test('health reports api-submissions surface posture', () => {
  const payload = health();
  assert.equal(payload.surface, 'api-submissions');
  assert.equal(payload.networkPosture, 'public-rate-limited');
  assert.ok(payload.allowedOperations.includes('write:quarantine'));
});

test('submissions compromise cannot publish', () => {
  assert.equal(deniesPublication('api-submissions'), true);
  assert.throws(() => guardPublishAttempt('publish:projection'), SurfaceCapabilityError);
  assert.throws(() => guardPublishAttempt('promote:release'), SurfaceCapabilityError);
});

test('submissions allows quarantine intake only', () => {
  assert.doesNotThrow(() => guardIntakeOperation('write:quarantine'));
  assert.throws(() => guardIntakeOperation('write:canonical'), SurfaceCapabilityError);
});

test('submissions App Check guard enforces replay protection when enabled', async () => {
  const events: AppCheckTelemetryEvent[] = [];
  let consumeAppCheckToken = false;
  const guard = createSubmissionsApiAppCheckGuard({
    environment: { APP_CHECK_MODE: 'enforce' },
    verifier: {
      async verifyToken(_token, options) {
        consumeAppCheckToken = options.consumeAppCheckToken;
        return { appId: 'web-app', alreadyConsumed: true };
      },
    },
    telemetry: {
      record(event) {
        events.push(event);
      },
    },
  });

  const decision = await guard({ headers: { 'x-firebase-appcheck': 'replayed' } });

  assert.equal(consumeAppCheckToken, true);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'replayed_token');
  assert.equal(events[0]?.outcome, 'rejected');
});
