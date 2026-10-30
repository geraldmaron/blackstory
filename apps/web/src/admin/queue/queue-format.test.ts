import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatWaitingDays, isTypingTarget, nextRowIndex, waitingLabel } from './queue-format';

const NOW = new Date('2026-10-29T12:00:00Z');

test('formatWaitingDays counts whole days and pluralizes', () => {
  assert.equal(formatWaitingDays('2026-10-29T08:00:00Z', NOW), 'today');
  assert.equal(formatWaitingDays('2026-10-28T08:00:00Z', NOW), '1 day');
  assert.equal(formatWaitingDays('2026-07-18T12:00:00Z', NOW), '103 days');
});

test('formatWaitingDays tolerates future and unreadable times', () => {
  assert.equal(formatWaitingDays('2026-11-05T00:00:00Z', NOW), 'today');
  assert.equal(formatWaitingDays('not a date', NOW), '—');
});

test('waitingLabel names last activity for requests only', () => {
  assert.equal(waitingLabel('request'), 'last activity');
  assert.equal(waitingLabel('case'), 'waiting since');
});

test('nextRowIndex starts at the near end and clamps at both ends', () => {
  assert.equal(nextRowIndex(-1, 1, 5), 0);
  assert.equal(nextRowIndex(-1, -1, 5), 4);
  assert.equal(nextRowIndex(2, 1, 5), 3);
  assert.equal(nextRowIndex(4, 1, 5), 4);
  assert.equal(nextRowIndex(0, -1, 5), 0);
  assert.equal(nextRowIndex(0, 1, 0), -1);
});

test('isTypingTarget covers form controls and contenteditable', () => {
  assert.equal(isTypingTarget({ tagName: 'input' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'A' }), false);
});
