/** Admin surface capabilities share the web runtime and require staff authorization. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSurfaceDefinition } from '@repo/config';
import { guardAdminAuth, health } from './surface';

test('admin health reports staff-authenticated posture', () => {
  const payload = health();
  assert.equal(payload.surface, 'admin');
  assert.equal(payload.networkPosture, 'staff-authenticated');
});

test('admin is a distinct logical surface from web, scoped to its own module namespace', () => {
  const admin = getSurfaceDefinition('admin');
  const web = getSurfaceDefinition('web');
  assert.equal(admin.appPath, 'apps/web/src/admin');
  assert.notEqual(admin.appPath, web.appPath);
  assert.notEqual(admin.credentialScope, web.credentialScope);
});

test('admin rejects anonymous, ordinary user and service credentials', () => {
  for (const mode of ['anonymous', 'end-user-token', 'service-identity'] as const) {
    assert.throws(() => guardAdminAuth(mode));
  }
  assert.doesNotThrow(() => guardAdminAuth('staff-session'));
});
