/**
 * Tests for shared shell navigation absolutization helpers and footer IA.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FOOTER_NAV_COLUMNS,
  PRIMARY_NAV,
  absolutizeShellNav,
  isShellNavActive,
} from './shell-nav.ts';

test('absolutizeShellNav prefixes relative hrefs with the public origin', () => {
  const items = absolutizeShellNav(PRIMARY_NAV, 'http://localhost:3048/');
  assert.equal(items[0]?.href, 'http://localhost:3048/explore');
  assert.equal(items[1]?.label, 'History');
  assert.equal(items[2]?.label, 'Stories');
});

test('isShellNavActive understands absolute sibling hrefs', () => {
  assert.equal(isShellNavActive('/stories', 'http://localhost:3048/stories'), true);
  assert.equal(isShellNavActive('/stories/review', '/stories/review'), true);
  assert.equal(isShellNavActive('/explore', '/stories'), false);
});

test('footer IA groups Law under Explore, not Trust', () => {
  const explore = FOOTER_NAV_COLUMNS.find((column) => column.title === 'Explore');
  const trust = FOOTER_NAV_COLUMNS.find((column) => column.title === 'Trust');
  assert.ok(explore);
  assert.ok(trust);
  assert.deepEqual(
    explore.items.map((item) => item.href),
    ['/explore', '/history', '/stories', '/themes', '/data', '/law', '/books'],
  );
  assert.deepEqual(
    trust.items.map((item) => item.href),
    ['/methodology', '/memorial', '/errata', '/corrections'],
  );
});
