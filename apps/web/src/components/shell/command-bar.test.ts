/**
 * The phone bar must keep Rooms on the first row, not clip or wrap it away.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { primaryNavDestinations } from '../../lib/nav/destination-registry';

const here = dirname(fileURLToPath(import.meta.url));

test('the phone bar keeps Rooms on the first row instead of clipping it', () => {
  const css = readFileSync(join(here, 'command-bar.css'), 'utf8');
  const start = css.lastIndexOf('@media (max-width: 819px)');
  assert.ok(start >= 0, 'phone grid block must exist');
  const next = css.indexOf('@media', start + 1);
  const block = next === -1 ? css.slice(start) : css.slice(start, next);
  assert.doesNotMatch(block, /overflow-x:\s*clip/);
  assert.doesNotMatch(block, /max-width:\s*calc\(100vw/);
  assert.doesNotMatch(block, /flex-wrap:\s*wrap/);
  assert.match(block, /grid-template-areas:/);
  assert.match(block, /brand tools/);
  assert.match(block, /\.ds-bar__brand[\s\S]*max-width:\s*2rem/);
  assert.match(block, /\.ds-bar__tools[\s\S]*min-width:\s*0/);
  assert.match(block, /\.ds-bar__tool[\s\S]*display:\s*none/);
  assert.match(block, /height:\s*auto/);
});

test('the bar renders the product axes and never a hand-written list', () => {
  const source = readFileSync(join(here, 'CommandBar.tsx'), 'utf8');
  // Derived, not authored. This bar was the last hand-kept nav on the site, and what it left out
  // was Stories — one of the four ways into the product — reachable only through Rooms.
  assert.match(source, /primaryNavDestinations/);
  assert.match(source, /aria-label="Find"/);
  assert.match(source, /<RoomsMenu \/>/);
  // Home is the brand lockup, not a nav item beside Explore.
  assert.match(source, /ds-bar__brand[\s\S]*href="\/"/);
  assert.doesNotMatch(source, /\n\s*Door\n/);
  assert.doesNotMatch(source, />\s*Journey\s*</);
  assert.doesNotMatch(source, /onModeChange!\('story'\)/);
  // A literal axis href inside the nav is a second registry waiting to drift from the first.
  // Scoped to the nav element: the no-JS search fallback legitimately links `/records` as the
  // place a reader searches when the combobox cannot mount.
  const navStart = source.indexOf('aria-label="Find"');
  const nav = source.slice(navStart, source.indexOf('</nav>', navStart));
  for (const axis of ['/explore', '/stories', '/records']) {
    assert.doesNotMatch(
      nav,
      new RegExp(`href="${axis}"`),
      `${axis} must come from the registry, not a literal`,
    );
  }
});

test('the bar names exactly the four axes, in product order', () => {
  assert.deepEqual(
    primaryNavDestinations().map((axis) => axis.label),
    ['Explore', 'Stories', 'Records', 'Rooms'],
  );
});
