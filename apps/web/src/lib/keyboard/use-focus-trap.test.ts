/**
 * The trap's decision, separated from the DOM work it drives.
 *
 * `nextTrapIndex` is the whole rule: where Tab goes given a list of focusable elements and where
 * focus is now. Finding the list and calling `.focus()` needs a browser and is verified live; the
 * wrap-around arithmetic is where an off-by-one silently lets Tab out of an `aria-modal` dialog,
 * so it is pinned here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextTrapIndex } from './use-focus-trap';

test('Tab walks forward and wraps at the end', () => {
  assert.equal(nextTrapIndex(3, 0, false), 1);
  assert.equal(nextTrapIndex(3, 1, false), 2);
  // The wrap is the trap. Without it, Tab from the last control lands on the stage behind.
  assert.equal(nextTrapIndex(3, 2, false), 0);
});

test('Shift-Tab walks backward and wraps at the start', () => {
  assert.equal(nextTrapIndex(3, 2, true), 1);
  assert.equal(nextTrapIndex(3, 0, true), 2);
});

test('focus outside the list enters at the near end', () => {
  // On open, focus sits on the dialog container itself, which is `tabindex="-1"` and so not in
  // the list. Tab should enter at the first control, not jump to whatever index -1 arithmetic
  // happens to produce.
  assert.equal(nextTrapIndex(3, -1, false), 0);
  assert.equal(nextTrapIndex(3, -1, true), 2);
});

test('an empty dialog reports nowhere to go rather than wrapping onto nothing', () => {
  assert.equal(nextTrapIndex(0, -1, false), -1);
  assert.equal(nextTrapIndex(0, 0, true), -1);
});

test('a single focusable control holds focus on itself', () => {
  assert.equal(nextTrapIndex(1, 0, false), 0);
  assert.equal(nextTrapIndex(1, 0, true), 0);
});
