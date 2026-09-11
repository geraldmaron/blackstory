/**
 * Shell navigation is derived from the semantic destination catalog, so these tests assert the
 * derivation rather than a second copy of the menu.
 *
 * The load-bearing one is "no shell destination is a legacy alias". The previous generation of
 * this file asserted the literal list `['/explore', '/chapters', '/library', '/about']`, which
 * meant the test agreed with the bug: `/chapters` and `/library` were both permanent redirects,
 * so the top nav of every page on the site pointed into a 308 and the suite stayed green.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allSemanticDestinations,
  isLegacyPath,
  semanticDestinationByPath,
} from '@repo/public-contracts/destinations';

import {
  ALL_SHELL_DESTINATIONS,
  FOOTER_NAV_COLUMNS,
  OVERFLOW_NAV,
  PRIMARY_NAV,
  isShellNavActive,
} from './shell-nav.ts';

const everyShellItem = [
  ...PRIMARY_NAV,
  ...OVERFLOW_NAV,
  ...ALL_SHELL_DESTINATIONS,
  ...FOOTER_NAV_COLUMNS.flatMap((column) => column.items),
];

test('primary nav is the four product axes', () => {
  assert.deepEqual(
    PRIMARY_NAV.map((item) => item.href),
    ['/explore', '/stories', '/records', '/rooms'],
  );
  assert.deepEqual(
    PRIMARY_NAV.map((item) => item.label),
    ['Explore', 'Stories', 'Records', 'Rooms'],
  );
});

test('home is reached through the brand lockup, not through a nav item', () => {
  assert.ok(!PRIMARY_NAV.some((item) => item.href === '/'));
});

test('About is not primary navigation', () => {
  assert.ok(!PRIMARY_NAV.some((item) => item.href === '/about'));
  assert.ok(OVERFLOW_NAV.some((item) => item.href === '/about'));
});

test('no shell destination anywhere is a legacy alias', () => {
  for (const item of everyShellItem) {
    assert.equal(isLegacyPath(item.href), false, `${item.href} is a redirect, not a destination`);
  }
});

test('every shell destination exists in the semantic catalog', () => {
  for (const item of everyShellItem) {
    assert.ok(semanticDestinationByPath(item.href), `${item.href} is not a known destination`);
  }
});

test('the retired surfaces cannot reappear in shell chrome', () => {
  const retired = ['/chapters', '/library', '/history', '/topics', '/themes', '/myths', '/facts'];
  for (const item of everyShellItem) {
    assert.ok(!retired.includes(item.href), `${item.href} is a retired surface`);
  }
});

test('overflow holds the supporting rooms, grouped read then trust then take part', () => {
  assert.deepEqual(
    OVERFLOW_NAV.map((item) => item.href),
    [
      '/law',
      '/data',
      '/books',
      '/memorial',
      '/about',
      '/faq',
      '/methodology',
      '/errata',
      '/submit',
      '/corrections',
      '/support',
    ],
  );
});

test('overflow never duplicates a primary axis', () => {
  const primary = new Set(PRIMARY_NAV.map((item) => item.href));
  for (const item of OVERFLOW_NAV) {
    assert.ok(!primary.has(item.href), `${item.href} is already a primary axis`);
  }
});

test('footer columns lead with Find and carry the three room families', () => {
  assert.deepEqual(
    FOOTER_NAV_COLUMNS.map((column) => column.title),
    ['Find', 'Read deeper', 'How it decides', 'Add to it'],
  );
  const find = FOOTER_NAV_COLUMNS[0];
  assert.ok(find);
  assert.deepEqual(
    find.items.map((item) => item.href),
    ['/explore', '/stories', '/records', '/rooms'],
  );
  assert.deepEqual(
    FOOTER_NAV_COLUMNS[2]?.items.map((item) => item.href),
    ['/about', '/faq', '/methodology', '/errata'],
  );
});

test('a private destination never reaches shell chrome', () => {
  const privatePaths = allSemanticDestinations()
    .filter((destination) => !destination.isPublic)
    .map((destination) => destination.path);
  for (const item of everyShellItem) {
    assert.ok(!privatePaths.includes(item.href), `${item.href} is not public`);
  }
});

test('isShellNavActive understands absolute sibling hrefs', () => {
  assert.equal(isShellNavActive('/stories', 'http://localhost:3048/stories'), true);
  assert.equal(isShellNavActive('/stories/buying-a-home', '/stories/buying-a-home'), true);
  assert.equal(isShellNavActive('/explore', '/explore'), true);
  assert.equal(isShellNavActive('/', '/explore'), false);
});
