/**
 * Unit tests for admin post-login redirect path sanitization.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeAdminNextPath } from './safe-admin-next-path';

test('defaults to operations home when next is missing or unsafe', () => {
  assert.equal(safeAdminNextPath(null), '/');
  assert.equal(safeAdminNextPath(''), '/');
  assert.equal(safeAdminNextPath('https://evil.example/'), '/');
  assert.equal(safeAdminNextPath('//evil.example'), '/');
  assert.equal(safeAdminNextPath('stories/review'), '/');
});

test('allows same-origin relative paths including deep desks', () => {
  assert.equal(safeAdminNextPath('/'), '/');
  assert.equal(safeAdminNextPath('/inbox'), '/inbox');
  assert.equal(safeAdminNextPath('/cases'), '/cases');
  assert.equal(safeAdminNextPath('/stories/review'), '/stories/review');
});
