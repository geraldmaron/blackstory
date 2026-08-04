/**
 * Guards the shell IA: the bar stays short, nothing is reachable twice through the chrome,
 * every surface stays reachable through the palette, and the retired console stays retired.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthGatedPath } from '../auth/protected-paths';
import {
  ADMIN_HOME,
  ADMIN_NAV_GROUPS,
  adminOverflowNav,
  adminPaletteItems,
  adminPrimaryNav,
} from './admin-nav';

const ALL_DESTINATIONS = [ADMIN_HOME, ...ADMIN_NAV_GROUPS.flatMap((group) => group.destinations)];

test('the bar stays short enough to scan — regression on the seven-item shell', () => {
  const primary = adminPrimaryNav();
  assert.ok(primary.length <= 5, `primary nav grew to ${primary.length} items`);
  assert.equal(primary[0]?.href, ADMIN_HOME.href);
});

test('every bar item is the entry point of a task group', () => {
  const entryPoints = new Set(ADMIN_NAV_GROUPS.map((group) => group.destinations[0].href));
  for (const item of adminPrimaryNav().slice(1)) {
    assert.ok(entryPoints.has(item.href), `${item.href} is on the bar but leads no group`);
  }
});

test('nothing on the bar is repeated in More — Inbox was reachable three ways', () => {
  const onBar = new Set(adminPrimaryNav().map((item) => item.href));
  for (const item of adminOverflowNav()) {
    assert.equal(onBar.has(item.href), false, `${item.href} appears in both the bar and More`);
  }
});

test('the bar plus More covers every admin destination exactly once', () => {
  const chrome = [...adminPrimaryNav(), ...adminOverflowNav()].map((item) => item.href);
  assert.deepEqual(
    [...chrome].sort(),
    [...new Set(chrome)].sort(),
    'a destination is duplicated across the chrome',
  );
  assert.deepEqual(
    [...chrome].sort(),
    ALL_DESTINATIONS.map((destination) => destination.href).sort(),
  );
});

test('the palette reaches every destination, including the ones on the bar', () => {
  const palette = adminPaletteItems();
  assert.deepEqual(
    palette.map((item) => item.id).sort(),
    ALL_DESTINATIONS.map((destination) => destination.href).sort(),
  );
  for (const item of palette.slice(1)) {
    assert.ok(item.group, `${item.id} has no palette group heading`);
  }
});

test('caller-supplied public handoffs reach More and the palette, but never the bar', () => {
  const extra = { href: 'https://example.org/stories', label: 'Public stories' };
  assert.ok(adminOverflowNav([extra]).some((item) => item.href === extra.href));
  assert.ok(
    adminPaletteItems([{ ...extra, group: 'Public site' }]).some((item) => item.id === extra.href),
  );
  assert.equal(
    adminPrimaryNav().some((item) => item.href === extra.href),
    false,
  );
});

test('every navigable admin destination is behind the edge auth gate', () => {
  for (const destination of ALL_DESTINATIONS) {
    assert.equal(isAuthGatedPath(destination.href), true, `${destination.href} must be gated`);
  }
});

test('the legacy console is gone from the IA', () => {
  const everything = [...adminPrimaryNav(), ...adminOverflowNav()].map((item) => item.href);
  assert.equal(
    everything.some((href) => href === '/console' || href.startsWith('/console/')),
    false,
  );
});
