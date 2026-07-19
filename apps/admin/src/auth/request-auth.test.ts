/**
 * Unit tests for admin API auth error surfacing (ADC quota-project failures).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorResponse } from './request-auth.ts';

test('authErrorResponse keeps typed authorization messages', async () => {
  const { ServerAdminAuthorizationError } = await import('./server-authorization.ts');
  const response = authErrorResponse(
    new ServerAdminAuthorizationError(
      'FIREBASE_ID_TOKEN_REQUIRED',
      'A Firebase bearer ID token is required',
    ),
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string; code: string };
  assert.equal(body.code, 'FIREBASE_ID_TOKEN_REQUIRED');
  assert.match(body.error, /bearer ID token/i);
});

test('authErrorResponse explains missing ADC quota project', async () => {
  const response = authErrorResponse(
    new Error(
      'Your application is authenticating by using local Application Default Credentials. The identitytoolkit.googleapis.com API requires a quota project',
    ),
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /GOOGLE_CLOUD_QUOTA_PROJECT/i);
  assert.doesNotMatch(body.error, /^Unauthorized$/);
});
