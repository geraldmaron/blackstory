/**
 * Verifies administrator claims, MFA and recent-authentication gates, server-only role
 * mutations, session revocation, and authentication alert emission.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AdminAuthorizationError,
  assertAdminPermission,
  assertRecentReauth,
  assertRoleMutationAuthorized,
  assertSessionNotRevoked,
  buildAdminCustomClaims,
  emitAdministrativeAuthAlert,
  resolveAdminPermissions,
  revokeAdminSessions,
  setAdminRoles,
  type AdministrativeAuthAlertEvent,
  type RoleMutationAuthPort,
  type SessionRevocationAuthPort,
  type VerifiedAdminToken,
} from './admin-auth.js';

const NOW = 1_750_000_000;

function token(overrides: Partial<VerifiedAdminToken> = {}): VerifiedAdminToken {
  return {
    uid: 'admin-1',
    auth_time: NOW - 60,
    bb_roles: ['admin'],
    firebase: { sign_in_second_factor: 'totp' },
    ...overrides,
  };
}

function assertCode(block: () => unknown, code: AdminAuthorizationError['code']): void {
  assert.throws(block, (error: unknown) => {
    assert.ok(error instanceof AdminAuthorizationError);
    assert.equal(error.code, code);
    return true;
  });
}

test('custom claims resolve role permissions without trusting unknown roles', () => {
  assert.deepEqual(buildAdminCustomClaims(['publication']), {
    bb_claims_version: 1,
    bb_roles: ['publication'],
  });
  assert.deepEqual(resolveAdminPermissions({ bb_roles: ['publication', 'owner'] }), [
    'publication:publish',
    'publication:retract',
  ]);
});

test('administrator access requires an MFA-authenticated Firebase token', () => {
  assertCode(
    () => assertAdminPermission(token({ firebase: undefined }), 'roles:change'),
    'ADMIN_MFA_REQUIRED',
  );
  assert.doesNotThrow(() =>
    assertAdminPermission(token({ firebase: undefined, amr: ['pwd', 'mfa'] }), 'roles:change'),
  );
});

test('role-derived permissions deny research-only publication', () => {
  assertCode(
    () => assertAdminPermission(token({ bb_roles: ['research'] }), 'publication:publish'),
    'ADMIN_PERMISSION_DENIED',
  );
});

test('every privileged action rejects stale authentication', () => {
  const stale = token({ auth_time: NOW - 601 });
  const actions = [
    'publication',
    'retraction',
    'rights_change',
    'policy_change',
    'privileged_export',
    'role_change',
  ] as const;
  for (const action of actions) {
    assertCode(
      () => assertRecentReauth(stale, action, { nowEpochSeconds: NOW }),
      'ADMIN_REAUTH_REQUIRED',
    );
  }
});

test('role mutations require a fresh admin token and prohibit self-demotion', () => {
  assertCode(
    () =>
      assertRoleMutationAuthorized(token({ bb_roles: ['security'] }), 'staff-2', ['research'], {
        nowEpochSeconds: NOW,
      }),
    'ADMIN_PERMISSION_DENIED',
  );
  assertCode(
    () =>
      assertRoleMutationAuthorized(token(), 'admin-1', ['research'], {
        nowEpochSeconds: NOW,
      }),
    'ADMIN_ROLE_MUTATION_INVALID',
  );
});

test('server role mutation writes claims and revokes existing sessions', async () => {
  const operations: string[] = [];
  let writtenClaims: Readonly<Record<string, unknown>> | undefined;
  const auth = {
    async getUser(uid: string) {
      operations.push(`get:${uid}`);
      return { customClaims: { tenant: 'black-book', admin: true } };
    },
    async setCustomUserClaims(uid: string, claims: Readonly<Record<string, unknown>>) {
      operations.push(`claims:${uid}`);
      writtenClaims = claims;
    },
    async revokeRefreshTokens(uid: string) {
      operations.push(`revoke:${uid}`);
    },
  } as RoleMutationAuthPort;

  const claims = await setAdminRoles(auth, token(), 'staff-2', ['publication'], {
    nowEpochSeconds: NOW,
  });

  assert.deepEqual(claims.bb_roles, ['publication']);
  assert.deepEqual(writtenClaims, {
    tenant: 'black-book',
    bb_claims_version: 1,
    bb_roles: ['publication'],
  });
  assert.deepEqual(operations, ['get:staff-2', 'claims:staff-2', 'revoke:staff-2']);
});

test('session revocation returns the Firebase cutoff and rejects older tokens', async () => {
  const auth = {
    async revokeRefreshTokens() {},
    async getUser() {
      return { tokensValidAfterTime: '2025-06-15T15:06:50.000Z' };
    },
  } as SessionRevocationAuthPort;

  const revocation = await revokeAdminSessions(auth, 'admin-1');

  assert.equal(revocation.revokedAfterEpochSeconds, 1_750_000_010);
  assertCode(
    () => assertSessionNotRevoked(token({ auth_time: 1_750_000_009 }), 1_750_000_010),
    'ADMIN_SESSION_REVOKED',
  );
  assert.doesNotThrow(() =>
    assertSessionNotRevoked(token({ auth_time: 1_750_000_010 }), 1_750_000_010),
  );
});

test('administrative login alert events emit without secrets', async () => {
  const events: AdministrativeAuthAlertEvent[] = [];
  const event: AdministrativeAuthAlertEvent = {
    type: 'admin_login',
    eventId: 'auth-event-1',
    occurredAt: '2025-06-15T15:06:40.000Z',
    uid: 'admin-1',
    outcome: 'succeeded',
    newDevice: true,
    deviceIdHash: 'sha256:device-pseudonym',
  };

  await emitAdministrativeAuthAlert({ emit: (value) => events.push(value) }, event);

  assert.deepEqual(events, [event]);
  assert.equal(JSON.stringify(events).includes('token'), false);
});
