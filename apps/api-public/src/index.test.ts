/**
 * Public API surface acceptance tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfaceCapabilityError, deniesCanonicalWrite, deniesPublication } from '@repo/config';
import type { ClientAttestationTelemetryEvent } from '@repo/security';
import { createPublicApiClientAttestationGuard } from './client-attestation.ts';
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

test('public API client attestation guard defaults to monitor mode without header', async () => {
  const events: ClientAttestationTelemetryEvent[] = [];
  const guard = createPublicApiClientAttestationGuard({
    environment: { NODE_ENV: 'test' },
    mode: 'monitor',
    telemetry: {
      record(event) {
        events.push(event);
      },
    },
  });

  const missing = await guard({ headers: {} });
  const verified = await guard({ headers: { 'x-blackstory-client': 'mobile/1.0.0; api=1' } });

  assert.equal(missing.allowed, true);
  assert.equal(missing.verified, false);
  assert.equal(verified.verified, true);
  assert.equal(events[0]?.mode, 'monitor');
  assert.equal(events[0]?.control, 'client_attestation');
});
