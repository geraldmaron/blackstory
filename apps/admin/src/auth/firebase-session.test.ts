/**
 * Tests for Firebase session authorizer and auth mode resolution.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FirebaseSessionAuthorizationError,
  createFirebaseSessionAuthorizer,
  normalizeAdminEmail,
} from './firebase-session-authorizer.ts';
import { resolveAdminAuthMode } from './mode.ts';

test('normalizeAdminEmail trims and lowercases', () => {
  assert.equal(normalizeAdminEmail('  GeraldMDagher@outlook.com '), 'geraldmdagher@outlook.com');
});

test('firebase session authorizer accepts any verified Firebase email and denies missing email', async () => {
  const authorizer = createFirebaseSessionAuthorizer({
    async verifyIdToken(idToken, checkRevoked) {
      assert.equal(checkRevoked, true);
      if (idToken === 'good') {
        return {
          uid: 'uid-1',
          email: 'geraldmdagher@outlook.com',
          auth_time: 1_750_000_000,
        };
      }
      if (idToken === 'no-email') {
        return {
          uid: 'uid-2',
          auth_time: 1_750_000_000,
        };
      }
      return {
        uid: 'uid-3',
        email: 'operator@example.com',
        auth_time: 1_750_000_000,
      };
    },
  });

  const ok = await authorizer.assertAuthenticated({ authorization: 'Bearer good' });
  assert.equal(ok.email, 'geraldmdagher@outlook.com');

  const other = await authorizer.assertAuthenticated({ authorization: 'Bearer other' });
  assert.equal(other.email, 'operator@example.com');

  await assert.rejects(
    authorizer.assertAuthenticated({ authorization: 'Bearer no-email' }),
    (error: unknown) =>
      error instanceof FirebaseSessionAuthorizationError && error.code === 'ADMIN_EMAIL_REQUIRED',
  );
});

test('resolveAdminAuthMode defaults to firebase and accepts allowlist alias', () => {
  assert.equal(resolveAdminAuthMode({}), 'firebase');
  assert.equal(resolveAdminAuthMode({ ADMIN_AUTH_MODE: 'firebase' }), 'firebase');
  assert.equal(resolveAdminAuthMode({ ADMIN_AUTH_MODE: 'allowlist' }), 'firebase');
  assert.equal(resolveAdminAuthMode({ ADMIN_AUTH_MODE: 'layered' }), 'layered');
});
