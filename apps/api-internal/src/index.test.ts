/**
 * Internal API surface acceptance tests (BB-021).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfaceCapabilityError } from '@black-book/config';
import { health } from './index.ts';
import { guardIncomingAuth, guardPublicationOperation, rejectEndUserToken } from './posture.ts';

test('health reports api-internal private-network posture', () => {
  const payload = health();
  assert.equal(payload.surface, 'api-internal');
  assert.equal(payload.networkPosture, 'private-network');
  assert.ok(payload.allowedOperations.includes('publish:projection'));
});

test('internal publication endpoints reject end-user tokens', () => {
  assert.throws(() => rejectEndUserToken('end-user-token'));
  assert.throws(() => rejectEndUserToken('anonymous'));
  assert.throws(() => guardIncomingAuth('end-user-token'), SurfaceCapabilityError);
  assert.doesNotThrow(() => guardIncomingAuth('service-identity'));
});

test('internal API may publish but is not public-read posture', () => {
  assert.doesNotThrow(() => guardPublicationOperation('promote:release'));
});
