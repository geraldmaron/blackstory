/**
 * Unit tests for the public "submit a lead" App Check guard. Injects a fake verifier
 * and telemetry sink so these tests never touch real Firebase Admin credentials the same
 * dependency-injection seam `apps/api-submissions/src/app-check.ts` exposes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppCheckTelemetryEvent, AppCheckVerifier } from '@repo/firebase';
import { createSubmitLeadAppCheckGuard } from './app-check-guard';

function headersFrom(record: Record<string, string>): Headers {
  return new Headers(record);
}

function acceptingVerifier(appId = 'test-app-id'): AppCheckVerifier {
  return {
    async verifyToken() {
      return { appId };
    },
  };
}

function rejectingVerifier(): AppCheckVerifier {
  return {
    async verifyToken() {
      throw new Error('invalid token');
    },
  };
}

function captureTelemetry() {
  const events: AppCheckTelemetryEvent[] = [];
  return { events, telemetry: { record: (event: AppCheckTelemetryEvent) => events.push(event) } };
}

test('monitor mode allows a missing token but records the failure', async () => {
  const { events, telemetry } = captureTelemetry();
  const guard = await createSubmitLeadAppCheckGuard({
    mode: 'monitor',
    verifier: rejectingVerifier(),
    telemetry,
  });
  const decision = await guard({ headers: headersFrom({}) });
  assert.equal(decision.allowed, true);
  assert.equal(decision.verified, false);
  assert.equal(events[0]?.outcome, 'monitored_failure');
});

test('enforce mode rejects a missing token with 401', async () => {
  const guard = await createSubmitLeadAppCheckGuard({
    mode: 'enforce',
    verifier: rejectingVerifier(),
    telemetry: { record: () => {} },
  });
  const decision = await guard({ headers: headersFrom({}) });
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.status, 401);
  assert.equal(decision.reason, 'missing_token');
});

test('enforce mode accepts a token the verifier confirms', async () => {
  const guard = await createSubmitLeadAppCheckGuard({
    mode: 'enforce',
    verifier: acceptingVerifier('legit-app'),
    telemetry: { record: () => {} },
  });
  const decision = await guard({
    headers: headersFrom({ 'x-firebase-appcheck': 'a-real-looking-token' }),
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.verified, true);
  if (decision.allowed) assert.equal(decision.appId, 'legit-app');
});

test('enforce mode rejects a token the verifier throws on', async () => {
  const guard = await createSubmitLeadAppCheckGuard({
    mode: 'enforce',
    verifier: rejectingVerifier(),
    telemetry: { record: () => {} },
  });
  const decision = await guard({ headers: headersFrom({ 'x-firebase-appcheck': 'garbage' }) });
  assert.equal(decision.allowed, false);
  if (decision.allowed) return;
  assert.equal(decision.reason, 'invalid_token');
});

test('accepts a plain header record in addition to a Headers instance', async () => {
  const guard = await createSubmitLeadAppCheckGuard({
    mode: 'enforce',
    verifier: acceptingVerifier(),
    telemetry: { record: () => {} },
  });
  const decision = await guard({ headers: { 'x-firebase-appcheck': 'token-value' } });
  assert.equal(decision.allowed, true);
});
