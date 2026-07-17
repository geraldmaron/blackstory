
/**
 * Acceptance tests for ADR-005 surface capability matrix.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SURFACE_IDS,
  SurfaceCapabilityError,
  assertAuthAccepted,
  assertOperationAllowed,
  buildSurfaceHealth,
  deniesCanonicalWrite,
  deniesPublication,
  getSurfaceDefinition,
  isAuthAccepted,
  rejectCanonicalWriteOperation,
  rejectPublicationOperation,
} from './surfaces.ts';

test('every surface id has a definition', () => {
  for (const surfaceId of SURFACE_IDS) {
    assert.equal(getSurfaceDefinition(surfaceId).id, surfaceId);
  }
});

test('submissions compromise cannot publish', () => {
  assert.equal(deniesPublication('api-submissions'), true);
  assert.throws(
    () => assertOperationAllowed('api-submissions', 'publish:projection'),
    SurfaceCapabilityError,
  );
  assert.throws(
    () => rejectPublicationOperation('api-submissions', 'promote:release'),
    SurfaceCapabilityError,
  );
});

test('public API compromise cannot modify canonical data', () => {
  assert.equal(deniesCanonicalWrite('api-public'), true);
  assert.throws(
    () => assertOperationAllowed('api-public', 'write:canonical'),
    SurfaceCapabilityError,
  );
  assert.throws(
    () => rejectCanonicalWriteOperation('api-public', 'write:canonical'),
    SurfaceCapabilityError,
  );
});

test('admin and web are separate deployables with distinct identities', () => {
  const web = getSurfaceDefinition('web');
  const admin = getSurfaceDefinition('admin');
  assert.notEqual(web.appPath, admin.appPath);
  assert.notEqual(web.serviceAccountId, admin.serviceAccountId);
  assert.notEqual(web.runtime, admin.runtime);
});

test('internal publication endpoints reject end-user tokens', () => {
  assert.equal(isAuthAccepted('api-internal', 'end-user-token'), false);
  assert.throws(
    () => assertAuthAccepted('api-internal', 'end-user-token'),
    (error: unknown) =>
      error instanceof SurfaceCapabilityError && error.reason === 'auth-denied',
  );
  assert.doesNotThrow(() => assertAuthAccepted('api-internal', 'service-identity'));
});

test('health payload includes surface posture fields', () => {
  const health = buildSurfaceHealth('api-public', 'test');
  assert.equal(health.surface, 'api-public');
  assert.equal(health.networkPosture, 'public-read');
  assert.ok(health.allowedOperations.includes('read:search'));
  assert.equal(health.status, 'ok');
});
