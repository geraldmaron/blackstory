/**
 * Unit tests for admin post-login redirect path sanitization.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeAdminNextPath } from './safe-admin-next-path';

test('defaults to operations home when next is missing or unsafe', () => {
  assert.equal(safeAdminNextPath(null), '/admin');
  assert.equal(safeAdminNextPath(''), '/admin');
  assert.equal(safeAdminNextPath('https://evil.example/'), '/admin');
  assert.equal(safeAdminNextPath('//evil.example'), '/admin');
  assert.equal(safeAdminNextPath('stories/review'), '/admin');
});

test('allows same-origin relative paths including deep desks', () => {
  assert.equal(safeAdminNextPath('/admin'), '/admin');
  assert.equal(safeAdminNextPath('/admin/inbox'), '/admin/inbox');
  assert.equal(safeAdminNextPath('/admin/cases'), '/admin/cases');
  assert.equal(safeAdminNextPath('/admin/stories/review'), '/admin/stories/review');
});
