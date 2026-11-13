import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { SHEET_PEEK_HEIGHT, detentAfterDrag, nextDetent, sheetHeightFor } from './ExploreColumn';

test('sheet heights rise peek, half, full, and full stops under the header', () => {
  const peek = sheetHeightFor('peek', 844);
  const half = sheetHeightFor('half', 844);
  const full = sheetHeightFor('full', 844);
  assert.equal(peek, SHEET_PEEK_HEIGHT);
  assert.ok(peek < half && half < full);
  assert.ok(full <= 844 - 48 - 56);
  // A short screen never inverts the order.
  assert.ok(sheetHeightFor('half', 400) >= SHEET_PEEK_HEIGHT);
});

test('a drag moves one detent, a long drag two, a nudge none', () => {
  assert.equal(detentAfterDrag('peek', -80, 0.1), 'half');
  assert.equal(detentAfterDrag('peek', -400, 0.1), 'full');
  assert.equal(detentAfterDrag('full', 90, 0.1), 'half');
  assert.equal(detentAfterDrag('half', 20, 0.1), 'half');
  assert.equal(detentAfterDrag('half', 30, 1.2), 'peek');
  assert.equal(detentAfterDrag('peek', 200, 0.1), 'peek');
});

test('a press of the grab bar cycles peek, half, full, peek', () => {
  assert.equal(nextDetent('peek'), 'half');
  assert.equal(nextDetent('half'), 'full');
  assert.equal(nextDetent('full'), 'peek');
});

test('the grab bar is a 44px target whose press survives the drag handling', () => {
  const source = readFileSync(new URL('./ExploreColumn.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./explore-column.css', import.meta.url), 'utf8');
  // Capture retargets the click away from the button, so it waits until the pointer has moved.
  const down = source.slice(
    source.indexOf('const onPointerDown'),
    source.indexOf('const onPointerMove'),
  );
  assert.doesNotMatch(down, /setPointerCapture/);
  // A keyboard press (Enter, Space: click detail 0) is never swallowed as the end of a drag.
  assert.match(source, /event\.detail !== 0/);
  assert.match(css, /\.ds-xcol__grab \{[^}]*height:\s*44px/s);
  assert.match(css, /\.ds-xcol--sheet \.ds-xcol__top \{[^}]*user-select:\s*none/s);
});
