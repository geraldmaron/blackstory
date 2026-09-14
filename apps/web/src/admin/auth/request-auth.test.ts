/**
 * Unit tests for admin API request authorization: who the caller is, what the route requires,
 * and what a denial looks like on the wire.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorResponse, createAdminRouteAuthorizer } from './request-auth';
import { AdminRouteUndeclaredError } from './route-permissions';
import { StaffPermissionDeniedError } from './staff-permissions';
import type { StaffRole } from './role-mutation';
import type { SupabaseUserVerifier } from './supabase-session-authorizer';

/** A token that verifies, for a staff account holding exactly the given role. */
function verifierForRole(role: StaffRole): SupabaseUserVerifier {
  return {
    async getUser() {
      return {
        data: {
          user: {
            id: `uid-${role}`,
            email: `${role}@blackstory.test`,
            app_metadata: { bb_role: role },
          },
        },
        error: null,
      };
    },
  };
}

function adminRequest(method: string, path: string): Request {
  return new Request(`https://blackstory.test${path}`, {
    method,
    headers: { authorization: 'Bearer verified-token' },
  });
}

async function authorize(role: StaffRole, method: string, path: string) {
  return createAdminRouteAuthorizer(verifierForRole(role)).authorize(adminRequest(method, path));
}

test('a write route denies an authenticated caller whose role lacks the permission', async () => {
  await assert.rejects(
    () => authorize('publication', 'POST', '/admin/api/research-cases/case-1/transition'),
    (error: unknown) => {
      assert.ok(error instanceof StaffPermissionDeniedError);
      assert.equal(error.role, 'publication');
      assert.equal(error.permission, 'research:write');
      return true;
    },
  );

  const response = authErrorResponse(
    new StaffPermissionDeniedError('publication', 'research:write'),
  );
  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: string; code: string };
  assert.equal(body.code, 'ADMIN_PERMISSION_DENIED');
  assert.match(body.error, /research:write/);
});

test('a write route admits an authenticated caller whose role holds the permission', async () => {
  const caller = await authorize('research', 'POST', '/admin/api/research-cases/case-1/transition');
  assert.equal(caller.role, 'research');
  assert.equal(caller.email, 'research@blackstory.test');
  assert.equal(caller.uid, 'uid-research');
});

test('bulk catalog decisions are closed to every role but admin', async () => {
  for (const role of ['research', 'publication', 'security'] as const) {
    await assert.rejects(
      () => authorize(role, 'POST', '/admin/api/catalog/bulk-decision'),
      StaffPermissionDeniedError,
    );
  }
  const caller = await authorize('admin', 'POST', '/admin/api/catalog/bulk-decision');
  assert.equal(caller.role, 'admin');
});

test('promotion and release staging are closed to research and security', async () => {
  for (const path of [
    '/admin/api/research-cases/case-1/promote',
    '/admin/api/releases/stage',
  ] as const) {
    await assert.rejects(() => authorize('research', 'POST', path), StaffPermissionDeniedError);
    await assert.rejects(() => authorize('security', 'POST', path), StaffPermissionDeniedError);
    assert.equal((await authorize('publication', 'POST', path)).role, 'publication');
    assert.equal((await authorize('admin', 'POST', path)).role, 'admin');
  }
});

test('read routes admit every staff role', async () => {
  for (const role of ['admin', 'research', 'publication', 'security'] as const) {
    assert.equal((await authorize(role, 'GET', '/admin/api/audit')).role, role);
    assert.equal((await authorize(role, 'GET', '/admin/api/auth/me')).role, role);
  }
});

test('a route with no declared permission is denied even to an admin', async () => {
  await assert.rejects(
    () => authorize('admin', 'POST', '/admin/api/switches'),
    AdminRouteUndeclaredError,
  );
  await assert.rejects(
    () => authorize('admin', 'POST', '/admin/api/catalog/apply'),
    AdminRouteUndeclaredError,
  );

  const response = authErrorResponse(
    new AdminRouteUndeclaredError('POST', '/admin/api/catalog/apply'),
  );
  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: string; code: string };
  assert.equal(body.code, 'ADMIN_ROUTE_UNDECLARED');
  // The path the caller probed is not echoed back to them.
  assert.ok(!body.error.includes('/admin/api/catalog/apply'));
});

test('an unverified token is refused before the route is consulted', async () => {
  const failing: SupabaseUserVerifier = {
    async getUser() {
      return { data: { user: null }, error: { message: 'token expired' } };
    },
  };
  await assert.rejects(() =>
    createAdminRouteAuthorizer(failing).authorize(adminRequest('GET', '/admin/api/audit')),
  );
});

test('a request without a role claim is refused', async () => {
  const roleless: SupabaseUserVerifier = {
    async getUser() {
      return {
        data: { user: { id: 'uid-0', email: 'nobody@blackstory.test', app_metadata: {} } },
        error: null,
      };
    },
  };
  await assert.rejects(() =>
    createAdminRouteAuthorizer(roleless).authorize(adminRequest('GET', '/admin/api/audit')),
  );
});

test('authErrorResponse keeps typed authorization messages', async () => {
  const { ServerAdminAuthorizationError } = await import('./server-authorization');
  const response = authErrorResponse(
    new ServerAdminAuthorizationError(
      'ADMIN_BEARER_TOKEN_REQUIRED',
      'An administrator bearer token is required',
    ),
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string; code: string };
  assert.equal(body.code, 'ADMIN_BEARER_TOKEN_REQUIRED');
  assert.match(body.error, /bearer token/i);
});

test('authErrorResponse does not expose unexpected provider errors', async () => {
  const response = authErrorResponse(new Error('provider internal detail'));
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, 'Unauthorized');
});
