/**
 * Proves that administrator authorization is enforced on the server with IAP and Firebase
 * verification, revoked-token checking, privileged reauthentication, and server role mutation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mutateAdminRoles } from './role-mutation';
import {
  ServerAdminAuthorizationError,
  createServerAdminAuthorizer,
  type AdminAuthorizationPolicy,
} from './server-authorization';

const VALID_HEADERS = {
  authorization: 'Bearer firebase-id-token',
  'x-goog-iap-jwt-assertion': 'signed-iap-jwt',
};

function fixture() {
  const calls: string[] = [];
  const token = {
    uid: 'admin-1',
    email: 'ADMIN@example.org',
    auth_time: 1_750_000_000,
  };
  const policy: AdminAuthorizationPolicy = {
    assertAdminIdentity(identity) {
      calls.push(`identity:${identity.uid}`);
    },
    assertAdminPermission(identity, permission) {
      calls.push(`permission:${identity.uid}:${permission}`);
    },
    assertRecentReauth(identity, action) {
      calls.push(`reauth:${identity.uid}:${action}`);
    },
  };
  const authorizer = createServerAdminAuthorizer(
    {
      async verifyAssertion(assertion) {
        calls.push(`iap:${assertion}`);
        return { subject: 'iap-subject-1', email: 'admin@example.org' };
      },
    },
    {
      async verifyIdToken(idToken, checkRevoked) {
        calls.push(`firebase:${idToken}:${checkRevoked}`);
        return token;
      },
    },
    policy,
    { expectedIapEmailDomain: 'example.org' },
  );
  return { authorizer, calls, token };
}

test('server authorization requires both IAP and Firebase credentials', async () => {
  const { authorizer } = fixture();

  await assert.rejects(
    authorizer.assertAuthenticated({ authorization: 'Bearer firebase-id-token' }),
    (error: unknown) =>
      error instanceof ServerAdminAuthorizationError && error.code === 'IAP_ASSERTION_REQUIRED',
  );
  await assert.rejects(
    authorizer.assertAuthenticated({
      'x-goog-iap-jwt-assertion': 'signed-iap-jwt',
    }),
    (error: unknown) =>
      error instanceof ServerAdminAuthorizationError && error.code === 'FIREBASE_ID_TOKEN_REQUIRED',
  );
});

test('server permission checks verify revoked status and matching layered identities', async () => {
  const { authorizer, calls } = fixture();

  const identity = await authorizer.assertPermission(VALID_HEADERS, 'research:write');

  assert.equal(identity.admin.uid, 'admin-1');
  assert.ok(calls.includes('iap:signed-iap-jwt'));
  assert.ok(calls.includes('firebase:firebase-id-token:true'));
  assert.ok(calls.includes('permission:admin-1:research:write'));
});

test('server authorization rejects different IAP and Firebase users', async () => {
  const policy: AdminAuthorizationPolicy = {
    assertAdminIdentity() {},
    assertAdminPermission() {},
    assertRecentReauth() {},
  };
  const authorizer = createServerAdminAuthorizer(
    {
      async verifyAssertion() {
        return { subject: 'iap-subject-2', email: 'other@example.org' };
      },
    },
    {
      async verifyIdToken() {
        return { uid: 'admin-1', email: 'admin@example.org', auth_time: 1 };
      },
    },
    policy,
  );

  await assert.rejects(
    authorizer.assertAuthenticated(VALID_HEADERS),
    (error: unknown) =>
      error instanceof ServerAdminAuthorizationError && error.code === 'ADMIN_IDENTITY_MISMATCH',
  );
});

test('privileged operations always invoke the recent-reauthentication policy', async () => {
  const { authorizer, calls } = fixture();

  await authorizer.assertPrivilegedAction(VALID_HEADERS, 'publication');
  await authorizer.assertPrivilegedAction(VALID_HEADERS, 'retraction');
  await authorizer.assertPrivilegedAction(VALID_HEADERS, 'rights_change');
  await authorizer.assertPrivilegedAction(VALID_HEADERS, 'policy_change');
  await authorizer.assertPrivilegedAction(VALID_HEADERS, 'privileged_export');

  assert.deepEqual(
    calls.filter((entry) => entry.startsWith('reauth:')),
    [
      'reauth:admin-1:publication',
      'reauth:admin-1:retraction',
      'reauth:admin-1:rights_change',
      'reauth:admin-1:policy_change',
      'reauth:admin-1:privileged_export',
    ],
  );
});

test('role changes cannot reach mutation service before server reauthentication', async () => {
  const { authorizer, calls } = fixture();

  await mutateAdminRoles(VALID_HEADERS, 'staff-2', ['publication'], authorizer, {
    async setRoles(actor, targetUid, roles) {
      calls.push(`mutate:${actor.uid}:${targetUid}:${roles.join(',')}`);
    },
  });

  assert.ok(
    calls.indexOf('reauth:admin-1:role_change') <
      calls.indexOf('mutate:admin-1:staff-2:publication'),
  );
});
