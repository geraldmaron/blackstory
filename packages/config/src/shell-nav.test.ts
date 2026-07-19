/**
 * Tests for shared shell navigation absolutization helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRIMARY_NAV,
  absolutizeShellNav,
  isShellNavActive,
} from './shell-nav.ts';

test('absolutizeShellNav prefixes relative hrefs with the public origin', () => {
  const items = absolutizeShellNav(PRIMARY_NAV, 'http://localhost:3048/');
  assert.equal(items[0]?.href, 'http://localhost:3048/explore');
  assert.equal(items[3]?.label, 'Stories');
});

test('isShellNavActive understands absolute sibling hrefs', () => {
  assert.equal(isShellNavActive('/stories', 'http://localhost:3048/stories'), true);
  assert.equal(isShellNavActive('/stories/review', '/stories/review'), true);
  assert.equal(isShellNavActive('/explore', '/stories'), false);
});
