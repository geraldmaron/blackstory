/**
 * Proves the role/permission table is a real gate, not a declaration nothing reads (repo-qv9h).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  StaffPermissionDeniedError,
  assertStaffPermission,
  permissionsForStaffRole,
  staffRoleHasPermission,
} from './staff-permissions';

test('no non-admin staff role can change roles or policy', () => {
  for (const role of ['research', 'publication', 'security'] as const) {
    assert.equal(staffRoleHasPermission(role, 'roles:change'), false);
    assert.equal(staffRoleHasPermission(role, 'policy:change'), false);
  }
  assert.equal(staffRoleHasPermission('admin', 'roles:change'), true);
});

test('publication cannot touch canonical records and research cannot publish', () => {
  assert.equal(staffRoleHasPermission('publication', 'canonical:write'), false);
  assert.equal(staffRoleHasPermission('publication', 'canonical:merge'), false);
  assert.equal(staffRoleHasPermission('research', 'publication:publish'), false);
  assert.equal(staffRoleHasPermission('research', 'publication:retract'), false);
});

test('bulk and merge stay with admin; field edits reach research', () => {
  assert.equal(staffRoleHasPermission('research', 'canonical:write'), true);
  assert.equal(staffRoleHasPermission('research', 'canonical:bulk_write'), false);
  assert.equal(staffRoleHasPermission('admin', 'canonical:bulk_write'), true);
});

test('assertStaffPermission throws a typed denial carrying role and permission', () => {
  assert.throws(
    () => assertStaffPermission('security', 'canonical:merge'),
    (error: unknown) =>
      error instanceof StaffPermissionDeniedError &&
      error.role === 'security' &&
      error.permission === 'canonical:merge',
  );
  assert.doesNotThrow(() => assertStaffPermission('admin', 'canonical:merge'));
});

test('every role resolves to a concrete permission list', () => {
  for (const role of ['admin', 'research', 'publication', 'security'] as const) {
    assert.ok(permissionsForStaffRole(role).length > 0, `${role} should have permissions`);
  }
});
