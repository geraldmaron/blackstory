
/**
 * Verifies deterministic shared test utilities and their failure behavior.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureLines, createSequence, fixedClock, steppingClock } from './utilities.ts';

test('fixedClock returns independent dates at one instant', () => {
  const clock = fixedClock('2026-01-01T00:00:00.000Z');

  assert.equal(clock().toISOString(), '2026-01-01T00:00:00.000Z');
  assert.notEqual(clock(), clock());
});

test('createSequence returns values in order and rejects exhaustion', () => {
  const nextValue = createSequence(['first', 'second']);

  assert.equal(nextValue(), 'first');
  assert.equal(nextValue(), 'second');
  assert.throws(() => nextValue(), /exhausted/);
});

test('captureLines collects sink output', () => {
  const capture = captureLines();

  capture.write('one');
  capture.write('two');

  assert.deepEqual(capture.lines, ['one', 'two']);
});

test('steppingClock advances by the configured step', () => {
  const clock = steppingClock('2026-01-01T00:00:00.000Z', 1000);
  assert.equal(clock().toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(clock().toISOString(), '2026-01-01T00:00:01.000Z');
});
