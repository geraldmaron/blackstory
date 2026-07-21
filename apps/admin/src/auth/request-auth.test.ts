/**
 * Unit tests for admin API auth error surfacing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorResponse } from './request-auth.ts';

test('authErrorResponse keeps typed authorization messages', async () => {
  const { ServerAdminAuthorizationError } = await import('./server-authorization.ts');
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
