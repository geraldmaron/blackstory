import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sheetDragOffset, sheetDragOutcome } from './use-compact-sheet-drag';

test('a peek sheet: drag down dismisses, drag up opens full, a nudge snaps back', () => {
  assert.equal(sheetDragOutcome('peek', 120, 0.2), 'dismiss');
  assert.equal(sheetDragOutcome('peek', -80, 0.2), 'full');
  assert.equal(sheetDragOutcome('peek', 30, 0.2), 'peek');
  assert.equal(sheetDragOutcome('peek', -20, 0.2), 'peek');
});

test('a flick counts however short it was', () => {
  assert.equal(sheetDragOutcome('peek', 30, 1.2), 'dismiss');
  assert.equal(sheetDragOutcome('peek', -30, 1.2), 'full');
});

test('a full sheet drags back down to its peek rather than vanishing', () => {
  assert.equal(sheetDragOutcome('full', 150, 0.2), 'peek');
  assert.equal(sheetDragOutcome('full', -100, 0.2), 'full');
});

test('dragging up past the top rubber-bands instead of tracking the finger', () => {
  assert.equal(sheetDragOffset(40), 40);
  assert.ok(sheetDragOffset(-400) >= -60);
  assert.ok(sheetDragOffset(-25) < 0);
});
