/**
 * The Rooms menu lists the rooms. It does not advertise the old board as a cockpit.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { destinationsInGroup } from '../../lib/nav/destination-registry';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'RoomsMenu.tsx'), 'utf8');

test('the room menu is the locked about groups, not a second board', () => {
  // The hub link is new and deliberate: the control is named Rooms, and `/rooms` used to be
  // reachable from the footer and the breadcrumb chain but from nothing in the bar.
  assert.match(source, /href="\/rooms"/);
  assert.match(source, /All rooms/);
  assert.doesNotMatch(source, /Straight to the records/);
  assert.doesNotMatch(source, /The Atlas answers where and when/);
  assert.doesNotMatch(source, /The whole archive as a list/);
  assert.doesNotMatch(source, /Everything here is also reachable/);
  assert.doesNotMatch(source, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(source, /['"`]\/banned-books/);
  assert.doesNotMatch(source, /DIRECT_PATHS|\/explore|\/records/);
});

test('the Rooms menu rooms come from the same registry groups the hub renders', () => {
  assert.match(source, /ROOMS_CARD_GROUPS/);
  assert.match(source, /destinationsInGroup/);
  assert.ok(destinationsInGroup('read').some((destination) => destination.path === '/books'));
  // The menu lists rooms, never the product axes — those are always-visible primary nav.
  for (const axis of ['/explore', '/stories', '/records', '/rooms']) {
    assert.ok(
      !destinationsInGroup('read').some((destination) => destination.path === axis),
      `${axis} is an axis, not a room`,
    );
  }
});

test('the narrow rooms panel clears the stacked bar, not the Explore gutter', () => {
  const css = readFileSync(join(here, 'rooms-menu.css'), 'utf8');
  assert.match(css, /@media \(max-width: 60rem\)/);
  assert.match(css, /--ds-island-height/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.doesNotMatch(css, /--ds-atlas-top/);
});

test('on the phone the rooms panel sits below the island and does not cover the trigger', () => {
  const css = readFileSync(join(here, 'rooms-menu.css'), 'utf8');
  assert.match(css, /@media \(max-width: 819px\)/);
  assert.match(css, /@media \(max-width: 819px\)[\s\S]*--ds-island-clearance/);
  assert.match(
    css,
    /@media \(max-width: 819px\)[\s\S]*max-height:\s*calc\(100dvh - var\(--ds-island-clearance\)/,
  );
});
