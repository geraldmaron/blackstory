/**
 * Proves console permission denial, fresh-auth reasons, publication boundaries, and bulk limits.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuthorizedAdminRequest } from './auth/index';
import { CONSOLE_SURFACES } from './console/fixtures';
import {
  ConsoleActionError,
  assertNoActiveProjectionWrite,
  authorizeConsoleAction,
  previewBulkAction,
  type ConsoleActionAuthorizer,
} from './console/guards';
import type { ConsoleAction } from './console/model';

const HEADERS = {
  authorization: 'Bearer verified-firebase-token',
  'x-goog-iap-jwt-assertion': 'verified-iap-assertion',
};

const IDENTITY: AuthorizedAdminRequest = {
  iap: { subject: 'iap-operator-1', email: 'operator@example.org' },
  admin: {
    uid: 'operator-1',
    email: 'operator@example.org',
    auth_time: 1_750_000_000,
  },
};

function fixtureAction(overrides: Partial<ConsoleAction> = {}): ConsoleAction {
  return {
    id: 'fixture-change',
    label: 'Fixture change',
    permission: 'research:write',
    endpoint: '/api/admin/fixture-change',
    destination: 'canonical-draft',
    publicationDiff: {
      added: 0,
      changed: 1,
      removed: 0,
      unchanged: 3,
      releaseCandidateId: 'rel-fixture',
    },
    ...overrides,
  };
}

test('permission denial prevents a console action', async () => {
  const denied: ConsoleActionAuthorizer = {
    async assertPermission() {
      throw new Error('permission denied');
    },
    async assertPrivilegedAction() {
      throw new Error('privileged action denied');
    },
  };

  await assert.rejects(
    authorizeConsoleAction({ headers: HEADERS, action: fixtureAction() }, denied),
    /permission denied/,
  );
});

test('high-impact actions require both a reason and privileged fresh-auth authorization', async () => {
  const calls: string[] = [];
  const authorizer: ConsoleActionAuthorizer = {
    async assertPermission() {
      calls.push('permission');
      return IDENTITY;
    },
    async assertPrivilegedAction(_headers, action) {
      calls.push(`fresh-auth:${action}`);
      return IDENTITY;
    },
  };
  const action = fixtureAction({
    permission: 'publication:publish',
    privilegedAction: 'publication',
    destination: 'release-candidate',
  });

  await assert.rejects(
    authorizeConsoleAction({ headers: HEADERS, action }, authorizer),
    (error: unknown) => error instanceof ConsoleActionError && error.code === 'REASON_REQUIRED',
  );
  assert.deepEqual(calls, []);

  const authorized = await authorizeConsoleAction(
    { headers: HEADERS, action, reason: 'Reviewed release diff and source rights.' },
    authorizer,
  );
  assert.deepEqual(calls, ['fresh-auth:publication']);
  assert.equal(authorized.reason, 'Reviewed release diff and source rights.');
});

test('console routes cannot target active public projections', () => {
  assert.throws(
    () =>
      assertNoActiveProjectionWrite(
        '/api/admin/active-projection/entity-1',
        'active-public-projection',
      ),
    (error: unknown) =>
      error instanceof ConsoleActionError && error.code === 'ACTIVE_PROJECTION_WRITE_PROHIBITED',
  );
  assert.doesNotThrow(() =>
    assertNoActiveProjectionWrite('/api/admin/releases/candidate-1', 'release-candidate'),
  );
});

test('bulk actions require preview, enforce limits, and issue a rollback token', () => {
  const action = fixtureAction({
    bulk: { maximumItems: 2, rollbackSupported: true },
  });
  assert.throws(
    () => previewBulkAction(action, ['one', 'two', 'three']),
    (error: unknown) => error instanceof ConsoleActionError && error.code === 'BULK_LIMIT_EXCEEDED',
  );

  const preview = previewBulkAction(action, ['one', 'two']);
  assert.equal(preview.executionAllowed, false);
  assert.equal(preview.itemCount, 2);
  assert.match(preview.rollbackToken, /^rollback:fixture-change:2:/);
  assert.deepEqual(preview.publicationDiff, action.publicationDiff);
});

test('every configured action declares permission, protected endpoint, and publication diff', () => {
  for (const surface of CONSOLE_SURFACES) {
    assert.ok(surface.actions.length > 0, `${surface.id} must expose a guarded action`);
    for (const action of surface.actions) {
      assert.match(action.endpoint, /^\/api\/admin\//);
      assert.ok(action.permission);
      assert.ok(action.publicationDiff.releaseCandidateId);
    }
  }
});
