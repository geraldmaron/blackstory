import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDevtoolsConsoleFilter, isKnownDevtoolsBug } from './devtools-console-filter';

const BUG_TEXT =
  'React instrumentation encountered an error: Error: We are cleaning up async info that was not on the parent Suspense boundary. This is a bug in React.';

function fakeConsole() {
  const calls: unknown[][] = [];
  const target = {
    error: (...args: unknown[]) => {
      calls.push(args);
    },
  };
  return { target, calls };
}

test('isKnownDevtoolsBug matches the DevTools async-boundary message as string or Error', () => {
  assert.equal(isKnownDevtoolsBug([BUG_TEXT]), true);
  assert.equal(isKnownDevtoolsBug([new Error(BUG_TEXT)]), true);
  assert.equal(isKnownDevtoolsBug(['%s', new Error(BUG_TEXT)]), true);
  assert.equal(isKnownDevtoolsBug(['Hydration failed']), false);
  assert.equal(isKnownDevtoolsBug([]), false);
});

test('the filter drops the known bug and passes everything else to the native method', () => {
  const { target, calls } = fakeConsole();
  installDevtoolsConsoleFilter(target);
  target.error(BUG_TEXT);
  target.error('real problem', 42);
  assert.deepEqual(calls, [['real problem', 42]]);
});

test('a later console.error patch (Next dev overlay) still sits underneath the filter', () => {
  const { target, calls } = fakeConsole();
  installDevtoolsConsoleFilter(target);

  // Mirrors next-devtools intercept-console-error: capture "origin", then assign a wrapper.
  const overlaySeen: unknown[][] = [];
  const originConsoleError = target.error;
  target.error = function error(...args: unknown[]) {
    overlaySeen.push(args);
    originConsoleError.apply(target, args);
  };

  target.error(BUG_TEXT);
  target.error('still reported');

  assert.deepEqual(overlaySeen, [['still reported']], 'overlay never sees the DevTools bug');
  assert.deepEqual(calls, [['still reported']], 'native console still receives real errors once');
});

test('assigning a non-function restores the native method rather than breaking console.error', () => {
  const { target, calls } = fakeConsole();
  installDevtoolsConsoleFilter(target);
  (target as { error: unknown }).error = undefined;
  target.error('after reset');
  assert.deepEqual(calls, [['after reset']]);
});
