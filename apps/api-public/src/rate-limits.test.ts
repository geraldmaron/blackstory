/**
 * Public API rate-limit guard tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPublicRateLimitGuard,
  resolvePublicEndpointClass,
} from './rate-limits.ts';

test('resolvePublicEndpointClass maps read paths to endpoint classes', () => {
  assert.equal(resolvePublicEndpointClass('/v1/search', 'GET'), 'search');
  assert.equal(resolvePublicEndpointClass('/v1/locations/geocode', 'GET'), 'geocoding');
  assert.equal(resolvePublicEndpointClass('/v1/locations/nearby', 'GET'), 'nearbyDiscovery');
  assert.equal(resolvePublicEndpointClass('/v1/entities/abc-123', 'GET'), 'entityRetrieval');
  assert.equal(
    resolvePublicEndpointClass('/v1/entities/abc-123/sources', 'GET'),
    'sourceInspection',
  );
  assert.equal(resolvePublicEndpointClass('/v1/auth/password-reset', 'GET'), 'passwordReset');
  assert.equal(resolvePublicEndpointClass('/v1/auth/session', 'GET'), 'authentication');
  assert.equal(resolvePublicEndpointClass('/v1/corrections', 'POST'), null);
});

test('public rate limit guard denies anonymous search without App Check', () => {
  const guard = createPublicRateLimitGuard({ now: () => 1_700_001_000_000 });
  const decision = guard.evaluate({
    method: 'GET',
    path: '/v1/search?q=test',
    subject: 'anonymous',
    clientIp: '203.0.113.50',
    appCheckVerified: false,
  });

  assert.ok(decision);
  assert.equal(decision.endpointClass, 'search');
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    const response = guard.formatDeniedResponse(decision);
    assert.equal(response.status, 429);
    assert.ok(response.body.retryAfterSec >= 5);
  }
});

test('public rate limit guard allows authenticated entity reads with App Check', () => {
  const guard = createPublicRateLimitGuard({ now: () => 1_700_001_100_000 });
  const decision = guard.evaluate({
    method: 'GET',
    path: '/v1/entities/person-1',
    subject: 'authenticated',
    userId: 'user-99',
    appCheckVerified: true,
  });

  assert.ok(decision);
  assert.equal(decision.endpointClass, 'entityRetrieval');
  assert.equal(decision.allowed, true);
  guard.release(decision.key);
});

test('public guard skips non-quota paths', () => {
  const guard = createPublicRateLimitGuard();
  assert.equal(guard.evaluate({ method: 'GET', path: '/health', subject: 'anonymous' }), null);
});
