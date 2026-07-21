/**
 * Unit tests for entity session stack and next-entity selection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  back,
  canBack,
  canPickNext,
  createSessionStack,
  pickNext,
  push,
} from './entity-session-nav';

const ORDERED = ['a', 'b', 'c', 'd'] as const;

test('session stack push and back walk in order', () => {
  let stack = createSessionStack();
  assert.equal(canBack(stack), false);
  stack = push(stack, 'a');
  stack = push(stack, 'b');
  assert.equal(canBack(stack), true);

  const first = back(stack);
  assert.ok(first);
  assert.equal(first.entityId, 'b');
  assert.deepEqual(first.stack, ['a']);

  const second = back(first.stack);
  assert.ok(second);
  assert.equal(second.entityId, 'a');
  assert.deepEqual(second.stack, []);
  assert.equal(canBack(second.stack), false);
});

test('pickNext sequential advances and wraps excluding the current id', () => {
  assert.equal(
    pickNext({ random: false, currentId: 'b', orderedIds: ORDERED }),
    'c',
  );
  assert.equal(
    pickNext({ random: false, currentId: 'd', orderedIds: ORDERED }),
    'a',
  );
});

test('pickNext sequential falls back when current id is absent from the catalog', () => {
  assert.equal(
    pickNext({ random: false, currentId: 'z', orderedIds: ORDERED }),
    'a',
  );
});

test('pickNext random chooses among other ids only', () => {
  const next = pickNext({
    random: true,
    currentId: 'b',
    orderedIds: ORDERED,
    randomIndex: () => 0,
  });
  assert.equal(next, 'a');
});

test('pickNext returns undefined when no other entities exist', () => {
  assert.equal(
    pickNext({ random: false, currentId: 'solo', orderedIds: ['solo'] }),
    undefined,
  );
  assert.equal(canPickNext({ currentId: 'solo', orderedIds: ['solo'] }), false);
});
