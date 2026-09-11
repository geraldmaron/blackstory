/**
 * Unit tests for the edge auth gate's path coverage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthGatedPath } from './protected-paths';

/** Every page surface in app/admin. A new admin route must be added here. */
const ADMIN_PATHS = [
  '/admin',
  '/admin/audit',
  '/admin/cases',
  '/admin/cases/abc-123',
  '/admin/catalog',
  '/admin/catalog/abc-123',
  '/admin/citation-health',
  '/admin/discovery',
  '/admin/evidence',
  '/admin/graylist',
  '/admin/inbox',
  '/admin/quick-add',
  '/admin/releases',
  '/admin/sources',
  '/admin/stories/review',
  '/admin/stories/articles',
  '/admin/stories/articles/before-the-battle-cry',
  '/admin/switches',
];

test('every admin surface is behind the edge auth gate', () => {
  for (const path of ADMIN_PATHS) {
    assert.equal(isAuthGatedPath(path), true, `${path} must be auth-gated`);
  }
});

test('the sign-in page stays reachable, or sign-in would redirect to itself', () => {
  // Regression: a negative-lookahead `matcher` was not honored by Next 16, so /login went
  // through the gate and redirected to /login forever. The exclusion is code now, not regex.
  assert.equal(isAuthGatedPath('/admin/login'), false);
  assert.equal(isAuthGatedPath('/admin/login/'), false);
});

test('bearer-authenticated API routes are not cookie-gated', () => {
  for (const path of [
    '/admin/api/auth/me',
    '/admin/api/graylist',
    '/admin/api/research-cases/abc/promote',
  ]) {
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

test('a path outside /admin is never reached by this gate, but stays correct if it were', () => {
  // The middleware's own matcher ('/admin/:path*') already keeps these out — this is the same
  // "don't trust the matcher alone" belt-and-suspenders the sign-in/API exclusions above rely on.
  assert.equal(isAuthGatedPath('/explore'), true);
  assert.equal(isAuthGatedPath('/stories'), true);
});

test('an unknown admin path is gated by default rather than exposed', () => {
  assert.equal(isAuthGatedPath('/admin/some-future-surface'), true);
});
