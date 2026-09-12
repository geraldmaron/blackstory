/**
 * The `useSyncExternalStore` wiring behind `useReducedMotion`, tested the way this codebase tests
 * a hook this thin (see `use-focus-trap.ts`): the decision/wiring exported as plain functions,
 * exercised without a React renderer. `reduced-motion-listener.test.ts` already pins the
 * underlying listener's own behavior (latching, notify-on-change); this file pins that the hook
 * shares exactly one listener instance across every caller, per its own header comment.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  __resetSharedReducedMotionListenerForTests,
  getServerSnapshot,
  getSharedReducedMotionListener,
  getSnapshot,
  subscribe,
} from './use-reduced-motion';

type ChangeHandler = (event: { matches: boolean }) => void;

/** Installs a fake `window.matchMedia`, counting how many times it was called. */
function withFakeMatchMedia(initial: boolean): {
  handlers: ChangeHandler[];
  callCount: () => number;
  restore: () => void;
} {
  let callCount = 0;
  const handlers: ChangeHandler[] = [];
  const query = {
    matches: initial,
    addEventListener: (type: string, handler: ChangeHandler) => {
      if (type === 'change') handlers.push(handler);
    },
    removeEventListener: (type: string, handler: ChangeHandler) => {
      if (type !== 'change') return;
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    },
  };

  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  globalScope.window = {
    matchMedia: () => {
      callCount += 1;
      return query;
    },
  };

  return {
    handlers,
    callCount: () => callCount,
    restore: () => {
      if (previous === undefined) delete globalScope.window;
      else globalScope.window = previous;
      __resetSharedReducedMotionListenerForTests();
    },
  };
}

test('getServerSnapshot assumes no preference is known', () => {
  assert.equal(getServerSnapshot(), false);
});

test('getSnapshot reflects the shared listener, live', () => {
  const fake = withFakeMatchMedia(false);
  try {
    assert.equal(getSnapshot(), false);
    for (const handler of fake.handlers) handler({ matches: true });
    assert.equal(getSnapshot(), true);
  } finally {
    fake.restore();
  }
});

test('every caller shares exactly one underlying matchMedia subscription', () => {
  // The whole point of the shared singleton: N "components" asking for the snapshot cost one
  // matchMedia() call, not N — this is what makes it safe for several components (camera, sweep,
  // annotation overlay, memorial wall) to all call the hook without opening N subscriptions.
  const fake = withFakeMatchMedia(false);
  try {
    getSnapshot();
    getSnapshot();
    getSharedReducedMotionListener();
    subscribe(() => {});
    subscribe(() => {});
    assert.equal(fake.callCount(), 1);
  } finally {
    fake.restore();
  }
});

test('subscribe unsubscribes independently per caller', () => {
  const fake = withFakeMatchMedia(false);
  try {
    let a = 0;
    let b = 0;
    const unsubscribeA = subscribe(() => {
      a += 1;
    });
    subscribe(() => {
      b += 1;
    });
    for (const handler of fake.handlers) handler({ matches: true });
    assert.equal(a, 1);
    assert.equal(b, 1);
    unsubscribeA();
    for (const handler of fake.handlers) handler({ matches: false });
    assert.equal(a, 1);
    assert.equal(b, 2);
  } finally {
    fake.restore();
  }
});
