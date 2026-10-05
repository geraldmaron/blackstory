/**
 * The command bar: desktop carries the four axes as links; a phone carries one row (brand and
 * search) and navigates from the tab bar along the bottom edge.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { primaryNavDestinations } from '../../lib/nav/destination-registry';

const here = dirname(fileURLToPath(import.meta.url));

test('the phone bar is one row — brand and search — with no nav crammed into it', () => {
  const css = readFileSync(join(here, 'command-bar.css'), 'utf8');
  const start = css.indexOf('@media (max-width: 819px)');
  assert.ok(start >= 0, 'phone block must exist');
  const next = css.indexOf('@media', start + 1);
  const block = next === -1 ? css.slice(start) : css.slice(start, next);
  assert.match(block, /height:\s*56px/);
  assert.match(block, /grid-template-columns:\s*2rem minmax\(0, 1fr\)/);
  assert.match(block, /\.ds-bar__tools\s*\{\s*display:\s*none/);
  // The stacked two-row card and its scaled-down input are gone.
  assert.doesNotMatch(css, /brand tools/);
  assert.doesNotMatch(css, /scale\(0\.8125\)/);
  assert.doesNotMatch(css, /@media \(max-width: 559px\)/);
});

test('phones navigate from a bottom tab bar with the same four destinations everywhere', () => {
  const source = readFileSync(join(here, 'PhoneTabBar.tsx'), 'utf8');
  const bar = readFileSync(join(here, 'CommandBar.tsx'), 'utf8');
  const css = readFileSync(join(here, 'tab-bar.css'), 'utf8');
  assert.match(bar, /<PhoneTabBar /);
  assert.match(source, /primaryNavDestinations\(\)/);
  assert.doesNotMatch(source, /filter\(/, 'the tab set never changes per page');
  assert.match(source, /aria-label="Main"/);
  assert.match(css, /--ds-tabbar-h:\s*calc\(56px \+ env\(safe-area-inset-bottom/);
  assert.match(css, /pointer-events:\s*auto/);
});

test('the bar renders the product axes and never a hand-written list', () => {
  const source = readFileSync(join(here, 'CommandBar.tsx'), 'utf8');
  // Derived, not authored. This bar was the last hand-kept nav on the site, and what it left out
  // was Stories — one of the four ways into the product — reachable only through Rooms.
  assert.match(source, /primaryNavDestinations/);
  assert.match(source, /aria-label="Find"/);
  assert.match(source, /<RoomsMenu \/>/);
  assert.match(source, /DestinationIcon/);
  // Home is the brand lockup, not a nav item beside Explore.
  assert.match(source, /ds-bar__brand[\s\S]*href="\/"/);
  assert.doesNotMatch(source, /\n\s*Door\n/);
  assert.doesNotMatch(source, />\s*Journey\s*</);
  assert.doesNotMatch(source, /onModeChange!\('story'\)/);
  // Browse is a Map posture entered from journey CTAs, not a fifth Find chip beside Map.
  assert.doesNotMatch(source, />\s*Browse\s*</);
  assert.doesNotMatch(source, /enterMapBrowse/);
  assert.match(source, /exitMapBrowse/);
  assert.match(source, /pathIsBrowsing/);
  assert.doesNotMatch(source, />\s*Filters\s*</);
  // No per-page folding of destinations on phones any more (the tab bar replaced it).
  assert.doesNotMatch(source, /overflowFind|PHONE_OVERFLOW_AXIS_PATHS/);
  // A literal axis href inside the nav is a second registry waiting to drift from the first.
  // Scoped to the nav element: the no-JS search fallback legitimately links `/records` as the
  // place a reader searches when the combobox cannot mount.
  const navStart = source.indexOf('aria-label="Find"');
  const nav = source.slice(navStart, source.indexOf('</nav>', navStart));
  assert.doesNotMatch(nav, /href="\/explore"/);
  assert.doesNotMatch(nav, />\s*Browse\s*</);
  for (const axis of ['/stories', '/records']) {
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
    ['Map', 'Stories', 'Records', 'Rooms'],
  );
});
