/**
 * Guards the shell IA: groups stay few and small, nothing is listed twice, every surface stays
 * reachable through the palette, and the retired console stays retired.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthGatedPath } from '../auth/protected-paths';
import { ADMIN_HOME, ADMIN_NAV_GROUPS, adminPaletteItems, type AdminQueueKey } from './admin-nav';

const ALL_DESTINATIONS = [ADMIN_HOME, ...ADMIN_NAV_GROUPS.flatMap((group) => group.destinations)];

test('the sidebar stays short enough to scan: few groups, each a real task', () => {
  assert.ok(ADMIN_NAV_GROUPS.length <= 6, `grew to ${ADMIN_NAV_GROUPS.length} groups`);
  for (const group of ADMIN_NAV_GROUPS) {
    assert.ok(group.destinations.length >= 1, `${group.id} is empty`);
    assert.ok(group.destinations.length <= 5, `${group.id} has too many destinations`);
  }
});

test('no destination is listed twice, by path or by label within a group', () => {
  const hrefs = ALL_DESTINATIONS.map((destination) => destination.href);
  assert.deepEqual([...hrefs].sort(), [...new Set(hrefs)].sort(), 'a destination is duplicated');
  for (const group of ADMIN_NAV_GROUPS) {
    const labels = group.destinations.map((destination) => destination.label);
    assert.equal(new Set(labels).size, labels.length, `${group.id} repeats a label`);
  }
});

test('the palette reaches every destination', () => {
  const palette = adminPaletteItems();
  assert.deepEqual(
    palette.map((item) => item.id).sort(),
    ALL_DESTINATIONS.map((destination) => destination.href).sort(),
  );
  for (const item of palette.slice(1)) {
    assert.ok(item.group, `${item.id} has no palette group heading`);
  }
});

test('caller-supplied public handoffs reach the palette', () => {
  const extra = { href: 'https://example.org/stories', label: 'Public stories' };
  assert.ok(
    adminPaletteItems([{ ...extra, group: 'Public site' }]).some((item) => item.id === extra.href),
  );
});

test('each queue badge is claimed by exactly one destination', () => {
  const keys = ALL_DESTINATIONS.flatMap((destination) =>
    destination.queue ? [destination.queue] : [],
  );
  const known: readonly AdminQueueKey[] = ['submissions', 'inbox', 'storyReview'];
  assert.deepEqual([...keys].sort(), [...known].sort());
});

test('every navigable admin destination is behind the edge auth gate', () => {
  for (const destination of ALL_DESTINATIONS) {
    assert.equal(isAuthGatedPath(destination.href), true, `${destination.href} must be gated`);
  }
});

test('the legacy console is gone from the IA', () => {
  assert.equal(
    ALL_DESTINATIONS.some(
      (destination) => destination.href === '/console' || destination.href.startsWith('/console/'),
    ),
    false,
  );
});
