/**
 * Submissions API surface acceptance tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfaceCapabilityError, deniesPublication } from '@repo/config';
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

test('submissions client attestation guard denies missing header in enforce mode', async () => {
  const { createSubmissionsApiClientAttestationGuard } = await import('./client-attestation.ts');
  const events: Array<{ outcome: string }> = [];
  const guard = createSubmissionsApiClientAttestationGuard({
    environment: { CLIENT_ATTESTATION_MODE: 'enforce', NODE_ENV: 'production' },
    telemetry: {
      record(event) {
        events.push(event);
      },
    },
  });

  const decision = await guard({ headers: {} });

  assert.equal(decision.allowed, false);
  assert.equal(decision.verified, false);
  assert.equal(events[0]?.outcome, 'denied');
});
