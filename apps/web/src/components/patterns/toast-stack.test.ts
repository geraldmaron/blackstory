/**
 * Toast stack behavior: an actionable toast outlives a report-only one, and a repeated action
 * refreshes rather than stacks.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dismissToast,
  latestActionableToast,
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

test('a report-only toast leaves on its own; an actionable one waits for the reader', () => {
  assert.equal(toastDurationMs(plain), TOAST_DURATION_MS);
  // Null, not a longer number. Undo behind a timer is a race the reader did not agree to enter,
  // and the readers who need the longest to reach the button are the ones a timer excludes.
  assert.equal(TOAST_ACTION_DURATION_MS, null);
  assert.equal(toastDurationMs(actionable), null);
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

test('the undo chord acts on the newest toast that offers an action', () => {
  // Report-only toasts are skipped rather than blocking the chord: a "Citations copied." landing
  // on top of an Undo must not make ⌘Z do nothing.
  const stack = pushToast(pushToast(pushToast([], actionable), plain), {
    id: 'copied',
    message: 'Citations copied.',
  });
  assert.equal(latestActionableToast(stack)?.id, 'lens-reset');

  const twoActions = pushToast(stack, {
    id: 'saved-undo',
    message: 'Saved.',
    action: { label: 'Undo', run: () => {} },
  });
  assert.equal(latestActionableToast(twoActions)?.id, 'saved-undo', 'newest wins');
});

test('the undo chord is a no-op when nothing is offering an action', () => {
  assert.equal(latestActionableToast([]), null);
  assert.equal(latestActionableToast(pushToast([], plain)), null);
});

test('dismiss removes only the named toast', () => {
  const stack = pushToast(pushToast([], plain), actionable);
  assert.deepEqual(
    dismissToast(stack, 'saved').map((entry) => entry.id),
    ['lens-reset'],
  );
  assert.deepEqual(dismissToast(stack, 'missing'), stack);
});
