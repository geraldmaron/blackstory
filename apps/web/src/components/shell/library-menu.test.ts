/**
 * The Library menu lists the rooms. It does not advertise the old board as a cockpit.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { destinationsInGroup } from '../../lib/nav/destination-registry';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'LibraryMenu.tsx'), 'utf8');

test('the room menu is the locked about groups, not a second board', () => {
  assert.doesNotMatch(source, /href="\/library"/);
  assert.doesNotMatch(source, /Straight to the records/);
  assert.doesNotMatch(source, /The Atlas answers where and when/);
  assert.doesNotMatch(source, /The whole archive as a list/);
  assert.doesNotMatch(source, /Everything here is also reachable/);
  assert.doesNotMatch(source, /Open the Atlas|ATLAS_INSTRUMENT/);
  assert.doesNotMatch(source, /['"`]\/banned-books/);
  assert.doesNotMatch(source, /DIRECT_PATHS|\/explore|\/records/);
});

test('the library menu rooms come from the same registry groups the hub renders', () => {
  assert.match(source, /LIBRARY_CARD_GROUPS/);
  assert.match(source, /destinationsInGroup/);
  assert.ok(!destinationsInGroup('read').some((destination) => destination.path === '/books'));
});

test('the narrow rooms panel clears the stacked bar, not the Atlas gutter', () => {
  const css = readFileSync(join(here, 'library-menu.css'), 'utf8');
  assert.match(css, /@media \(max-width: 60rem\)/);
  assert.match(css, /--ds-island-height/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.doesNotMatch(css, /--ds-atlas-top/);
});
