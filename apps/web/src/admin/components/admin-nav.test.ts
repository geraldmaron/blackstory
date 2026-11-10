/**
 * Guards the shell IA: groups stay few and small, nothing is listed twice, every surface stays
 * reachable through the palette, and the retired console stays retired.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthGatedPath } from '../auth/protected-paths';
import {
  activeDestination,
  ADMIN_NAV_GROUPS,
  ADMIN_TOP_LEVEL,
  adminPaletteItems,
  type AdminQueueKey,
} from './admin-nav';

const ALL_DESTINATIONS = [
  ...ADMIN_TOP_LEVEL,
  ...ADMIN_NAV_GROUPS.flatMap((group) => group.destinations),
];

test('the sidebar stays short enough to scan: few groups, each a real task', () => {
  assert.ok(ADMIN_NAV_GROUPS.length <= 6, `grew to ${ADMIN_NAV_GROUPS.length} groups`);
  for (const group of ADMIN_NAV_GROUPS) {
    assert.ok(group.destinations.length >= 1, `${group.id} is empty`);
    assert.ok(group.destinations.length <= 9, `${group.id} has too many destinations`);
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
  // Top-level destinations sit above the groups and carry no group heading.
  for (const item of palette.slice(ADMIN_TOP_LEVEL.length)) {
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

test("groups follow the owner's jobs, in order", () => {
  assert.deepEqual(
    ADMIN_NAV_GROUPS.map((group) => group.label),
    ['Write', 'Records', 'Intake', 'Sources', 'System'],
  );
  assert.deepEqual(
    ADMIN_TOP_LEVEL.map((destination) => destination.label),
    ['Today'],
  );
});

test('old names still find their destination in the palette', () => {
  const find = (term: string) =>
    adminPaletteItems().find((item) => item.keywords?.includes(term))?.id;
  assert.equal(find('contributors'), '/admin/stories/contributors');
  assert.equal(find('operations'), '/admin');
});

test('exactly one destination is active, the longest match', () => {
  assert.equal(activeDestination('/admin'), '/admin');
  assert.equal(activeDestination('/admin/stories'), '/admin/stories');
  assert.equal(activeDestination('/admin/stories/some-slug'), '/admin/stories');
  assert.equal(activeDestination('/admin/stories/contributors'), '/admin/stories/contributors');
  assert.equal(activeDestination('/admin/stories/review'), '/admin/stories/review');
  assert.equal(activeDestination('/admin/queue'), '/admin/queue');
  assert.equal(activeDestination('/admin/unknown'), null);
});
