/**
 * Toast stack behaviour: an actionable toast outlives a report-only one, and a repeated action
 * refreshes rather than stacks.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dismissToast,
  pushToast,
  TOAST_ACTION_DURATION_MS,
  TOAST_DURATION_MS,
  TOAST_STACK_LIMIT,
  toastDurationMs,
  type ToastSpec,
} from './toast-stack';

const plain: ToastSpec = { id: 'saved', message: 'Saved to your list.' };
const actionable: ToastSpec = {
  id: 'lens-reset',
  message: 'Lens reset.',
  action: { label: 'Undo', run: () => {} },
};

test('an actionable toast stays longer than a report-only toast', () => {
  assert.equal(toastDurationMs(plain), TOAST_DURATION_MS);
  assert.equal(toastDurationMs(actionable), TOAST_ACTION_DURATION_MS);
  assert.ok(TOAST_ACTION_DURATION_MS > TOAST_DURATION_MS);
});

test('newest toast lands last', () => {
  const stack = pushToast(pushToast([], plain), actionable);
  assert.deepEqual(
    stack.map((entry) => entry.id),
    ['saved', 'lens-reset'],
  );
});

test('re-pushing an id replaces in place rather than duplicating', () => {
  const stack = pushToast(pushToast([], plain), { ...plain, message: 'Saved again.' });
  assert.equal(stack.length, 1);
  assert.equal(stack[0]?.message, 'Saved again.');
});

test('stack is capped and drops the oldest', () => {
  let stack: readonly ToastSpec[] = [];
  for (let index = 0; index < TOAST_STACK_LIMIT + 2; index += 1) {
    stack = pushToast(stack, { id: `t${index}`, message: `toast ${index}` });
  }
  assert.equal(stack.length, TOAST_STACK_LIMIT);
  assert.equal(stack[0]?.id, 't2');
  assert.equal(stack.at(-1)?.id, `t${TOAST_STACK_LIMIT + 1}`);
});

test('dismiss removes only the named toast', () => {
  const stack = pushToast(pushToast([], plain), actionable);
  assert.deepEqual(
    dismissToast(stack, 'saved').map((entry) => entry.id),
    ['lens-reset'],
  );
  assert.deepEqual(dismissToast(stack, 'missing'), stack);
});
