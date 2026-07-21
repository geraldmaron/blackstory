/**
 * Tests for Supabase session authorizer and supabase auth mode resolution.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAdminAuthMode, resolveClientAdminAuthMode } from './mode.ts';
import {
  SupabaseSessionAuthorizationError,
  createSupabaseSessionAuthorizer,
  readSupabaseRoleFromAppMetadata,
} from './supabase-session-authorizer.ts';

const FIXTURE_OPERATOR_EMAIL = 'operator@example.com';

test('resolveAdminAuthMode accepts supabase', () => {
  assert.equal(resolveAdminAuthMode({ ADMIN_AUTH_MODE: 'supabase' }), 'supabase');
  assert.equal(resolveClientAdminAuthMode({ NEXT_PUBLIC_ADMIN_AUTH_MODE: 'supabase' }), 'supabase');
});

test('readSupabaseRoleFromAppMetadata reads bb_role only from app_metadata', () => {
  assert.equal(readSupabaseRoleFromAppMetadata({ bb_role: 'admin' }), 'admin');
  assert.equal(readSupabaseRoleFromAppMetadata({ bb_role: 'research' }), 'research');
  assert.equal(readSupabaseRoleFromAppMetadata({ bb_role: 'owner' }), undefined);
  assert.equal(readSupabaseRoleFromAppMetadata(undefined), undefined);
});

test('supabase session authorizer verifies bearer token, email, and app_metadata.bb_role', async () => {
  const authorizer = createSupabaseSessionAuthorizer({
    async getUser(accessToken) {
      if (accessToken === 'admin-token') {
        return {
          data: {
            user: {
              id: 'uid-admin',
              email: FIXTURE_OPERATOR_EMAIL,
              app_metadata: { bb_role: 'admin' },
            },
          },
          error: null,
        };
      }
      if (accessToken === 'research-token') {
        return {
          data: {
            user: {
              id: 'uid-research',
              email: 'researcher@example.com',
              app_metadata: { bb_role: 'research' },
            },
          },
          error: null,
        };
      }
      if (accessToken === 'no-email') {
        return {
          data: { user: { id: 'uid-no-email', app_metadata: { bb_role: 'admin' } } },
          error: null,
        };
      }
      if (accessToken === 'no-role') {
        return {
          data: {
            user: {
              id: 'uid-no-role',
              email: FIXTURE_OPERATOR_EMAIL,
              app_metadata: {},
            },
          },
          error: null,
        };
      }
      if (accessToken === 'bad-role') {
        return {
          data: {
            user: {
              id: 'uid-bad-role',
              email: FIXTURE_OPERATOR_EMAIL,
              app_metadata: { bb_role: 'owner' },
            },
          },
          error: null,
        };
      }
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    },
  });

  const admin = await authorizer.assertAuthenticated({ authorization: 'Bearer admin-token' });
  assert.equal(admin.email, FIXTURE_OPERATOR_EMAIL);
  assert.equal(admin.role, 'admin');
  assert.equal(admin.admin.app_metadata.bb_role, 'admin');

  const research = await authorizer.assertAuthenticated({ authorization: 'Bearer research-token' });
  assert.equal(research.role, 'research');

  await assert.rejects(
    authorizer.assertAuthenticated({ authorization: 'Bearer expired' }),
    (error: unknown) =>
      error instanceof SupabaseSessionAuthorizationError && error.code === 'ADMIN_SESSION_INVALID',
  );

  await assert.rejects(
    authorizer.assertAuthenticated({ authorization: 'Bearer no-email' }),
    (error: unknown) =>
      error instanceof SupabaseSessionAuthorizationError && error.code === 'ADMIN_EMAIL_REQUIRED',
  );

  await assert.rejects(
    authorizer.assertAuthenticated({ authorization: 'Bearer no-role' }),
    (error: unknown) =>
      error instanceof SupabaseSessionAuthorizationError && error.code === 'ADMIN_ROLE_REQUIRED',
  );

  await assert.rejects(
    authorizer.assertAuthenticated({ authorization: 'Bearer bad-role' }),
    (error: unknown) =>
      error instanceof SupabaseSessionAuthorizationError && error.code === 'ADMIN_ROLE_UNKNOWN',
  );

  await assert.rejects(
    authorizer.assertAuthenticated({}),
    (error: unknown) => error instanceof Error && /bearer access token/i.test(error.message),
  );
});

test('authErrorResponse surfaces supabase role failures as 403', async () => {
  const { authErrorResponse } = await import('./request-auth.ts');
  const response = authErrorResponse(
    new SupabaseSessionAuthorizationError(
      'ADMIN_ROLE_REQUIRED',
      'Supabase administrator must have app_metadata.bb_role set',
    ),
  );
  assert.equal(response.status, 403);
  const body = (await response.json()) as { code: string };
  assert.equal(body.code, 'ADMIN_ROLE_REQUIRED');
});
