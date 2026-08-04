/**
 * Unit tests for the edge auth gate's path coverage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthGatedPath } from './protected-paths';

/** Every page surface in src/app. A new admin route must be added here. */
const ADMIN_PATHS = [
  '/',
  '/audit',
  '/cases',
  '/cases/abc-123',
  '/catalog',
  '/catalog/abc-123',
  '/citation-health',
  '/discovery',
  '/evidence',
  '/graylist',
  '/inbox',
  '/quick-add',
  '/releases',
  '/sources',
  '/stories/review',
  '/switches',
];

test('every admin surface is behind the edge auth gate', () => {
  for (const path of ADMIN_PATHS) {
    assert.equal(isAuthGatedPath(path), true, `${path} must be auth-gated`);
  }
});

test('the sign-in page stays reachable, or sign-in would redirect to itself', () => {
  // Regression: a negative-lookahead `matcher` was not honored by Next 16, so /login went
  // through the gate and redirected to /login forever. The exclusion is code now, not regex.
  assert.equal(isAuthGatedPath('/login'), false);
  assert.equal(isAuthGatedPath('/login/'), false);
});

test('bearer-authenticated API routes are not cookie-gated', () => {
  for (const path of ['/api/auth/me', '/api/graylist', '/api/research-cases/abc/promote']) {
    assert.equal(isAuthGatedPath(path), false, `${path} authenticates by bearer token`);
  }
});

test('next internals and static assets are not gated', () => {
  for (const path of [
    '/_next/static/chunk.js',
    '/_next/image',
    '/favicon.ico',
    '/brand/lockup-dark.png',
    '/fonts/x.woff2',
  ]) {
    assert.equal(isAuthGatedPath(path), false, `${path} must not be gated`);
  }
});

test('an unknown path is gated by default rather than exposed', () => {
  assert.equal(isAuthGatedPath('/some-future-surface'), true);
});
