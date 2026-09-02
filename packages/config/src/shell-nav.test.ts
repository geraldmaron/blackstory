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
  assert.equal(items[1]?.href, 'http://localhost:3048/chapters');
  assert.equal(items[0]?.label, 'Explore');
  assert.equal(items[1]?.label, 'Chapters');
});

test('primary nav leads with Explore and ends with About', () => {
  assert.deepEqual(
    PRIMARY_NAV.map((item) => item.href),
    // `/history` became a permanent redirect; the top nav on every page pointed into a 308 until
    // the v9 library hub replaced it (SP-21, repo-92n2.29).
    ['/explore', '/chapters', '/library', '/about'],
  );
});

test('isShellNavActive understands absolute sibling hrefs', () => {
  assert.equal(isShellNavActive('/chapters', 'http://localhost:3048/chapters'), true);
  assert.equal(isShellNavActive('/chapters/buying-a-home', '/chapters/buying-a-home'), true);
  assert.equal(isShellNavActive('/explore', '/explore'), true);
  assert.equal(isShellNavActive('/', '/explore'), false);
});

test('footer IA groups Law under Explore, not Trust', () => {
  const explore = FOOTER_NAV_COLUMNS.find((column) => column.title === 'Explore');
  const trust = FOOTER_NAV_COLUMNS.find((column) => column.title === 'Trust');
  assert.ok(explore);
  assert.ok(trust);
  assert.deepEqual(
    explore.items.map((item) => item.href),
    ['/explore', '/library', '/records', '/chapters', '/data', '/law', '/books'],
  );
  assert.deepEqual(
    trust.items.map((item) => item.href),
    ['/methodology', '/memorial', '/errata', '/corrections'],
  );
});
