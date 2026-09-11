/**
 * Admin surface identity acceptance tests.
 *
 * The "admin does not import apps/web handlers" check that used to live here is gone: admin
 * routes now live inside apps/web's own app router by design, so that assertion no longer tests
 * anything meaningful. What actually has to hold — that code outside `apps/web/src/admin/**`
 * cannot reach the write-capable canonical Postgres credential — is checked by
 * `canonical-write-boundary.test.ts` instead.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSurfaceDefinition } from '@repo/config';
import { health } from './surface';

test('admin health reports iap-protected posture', () => {
  const payload = health();
  assert.equal(payload.surface, 'admin');
  assert.equal(payload.networkPosture, 'iap-protected');
});

test('admin is a distinct logical surface from web, scoped to its own module namespace', () => {
  const admin = getSurfaceDefinition('admin');
  const web = getSurfaceDefinition('web');
  assert.equal(admin.appPath, 'apps/web/src/admin');
  assert.notEqual(admin.appPath, web.appPath);
  assert.notEqual(admin.serviceAccountId, web.serviceAccountId);
});
