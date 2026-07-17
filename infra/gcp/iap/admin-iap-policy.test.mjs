/**
 * Validates fail-closed administrator IAP and application-authorization design invariants.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const policy = JSON.parse(
  await readFile(new URL('./admin-iap-policy.json', import.meta.url), 'utf8'),
);

test('admin ingress is load-balancer-only and never unauthenticated', () => {
  assert.equal(policy.status, 'design-only');
  assert.equal(policy.cloudRunIngress, 'internal-and-cloud-load-balancing');
  assert.equal(policy.allowUnauthenticatedInvoker, false);
});

test('IAP assertion validation and group-scoped access are required', () => {
  assert.equal(policy.iap.enabled, true);
  assert.equal(policy.iap.validateJwtAudience, true);
  assert.equal(policy.iap.validateJwtIssuer, true);
  assert.equal(policy.iap.requiredRole, 'roles/iap.httpsResourceAccessor');
  assert.ok(policy.iap.accessorPrincipals.every((principal) => principal.startsWith('group:')));
});

test('IAP is layered with server-side Firebase MFA authorization', () => {
  assert.deepEqual(policy.applicationAuthorization, {
    provider: 'firebase-auth',
    requireVerifiedIdToken: true,
    checkRevoked: true,
    requireMfa: true,
    customClaimsVersion: 1,
    serverSideOnly: true,
  });
});
