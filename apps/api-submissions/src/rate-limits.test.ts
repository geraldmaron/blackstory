/**
 * Submissions API rate-limit guard tests (BB-025).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSubmissionsRateLimitGuard,
  resolveSubmissionsEndpointClass,
} from './rate-limits.ts';

test('resolveSubmissionsEndpointClass maps intake and admin paths', () => {
  assert.equal(resolveSubmissionsEndpointClass('/v1/corrections'), 'corrections');
  assert.equal(resolveSubmissionsEndpointClass('/v1/submissions'), 'corrections');
  assert.equal(resolveSubmissionsEndpointClass('/v1/auth/password-reset'), 'passwordReset');
  assert.equal(resolveSubmissionsEndpointClass('/v1/admin/exports'), 'adminExport');
  assert.equal(resolveSubmissionsEndpointClass('/v1/admin/research'), 'researchStart');
  assert.equal(
    resolveSubmissionsEndpointClass('/v1/admin/publication/preview'),
    'publicationPreview',
  );
});

test('submissions guard requires App Check for anonymous corrections', () => {
  const guard = createSubmissionsRateLimitGuard({ now: () => 1_700_002_000_000 });
  const denied = guard.evaluate({
    method: 'POST',
    path: '/v1/corrections',
    subject: 'anonymous',
    clientIp: '203.0.113.99',
    appCheckVerified: false,
  });
  assert.ok(denied);
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.reason, 'app_check_required');
  }
});

test('submissions guard allows authenticated corrections within quota', () => {
  const guard = createSubmissionsRateLimitGuard({ now: () => 1_700_002_050_000 });
  const decision = guard.evaluate({
    method: 'POST',
    path: '/v1/corrections',
    subject: 'authenticated',
    userId: 'user-corrector',
    appCheckVerified: true,
  });
  assert.ok(decision);
  assert.equal(decision.allowed, true);
  guard.release(decision.key);
});

test('submissions guard blocks anonymous admin exports', () => {
  const guard = createSubmissionsRateLimitGuard({ now: () => 1_700_002_100_000 });
  const decision = guard.evaluate({
    method: 'POST',
    path: '/v1/admin/exports',
    subject: 'anonymous',
    clientIp: '198.51.100.2',
    appCheckVerified: true,
  });

  assert.ok(decision);
  assert.equal(decision.endpointClass, 'adminExport');
  assert.equal(decision.allowed, false);
});

test('submissions guard aggregates distributed risk on corrections flood', () => {
  const guard = createSubmissionsRateLimitGuard({
    now: () => 1_700_002_200_000,
    riskScoreThreshold: 8,
  });
  const decision = guard.evaluate({
    method: 'POST',
    path: '/v1/corrections',
    subject: 'authenticated',
    userId: 'brigade-user',
    appCheckVerified: true,
    riskSignals: [
      { kind: 'device_burst', weight: 3, observedAtMs: 1_700_002_199_000, dimension: 'd1' },
      { kind: 'session_burst', weight: 3, observedAtMs: 1_700_002_198_500, dimension: 's1' },
      { kind: 'account_rotation', weight: 3, observedAtMs: 1_700_002_198_000, dimension: 'c1' },
    ],
  });

  assert.ok(decision);
  assert.equal(decision.allowed, false);
  assert.ok(decision.riskAggregation?.exceedsThreshold);
});
