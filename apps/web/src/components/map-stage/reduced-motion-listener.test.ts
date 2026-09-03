/**
 * The live reduced-motion read.
 *
 * The behavior under test is that a preference flipped mid-session is visible to the next camera
 * decision without a reload. A one-shot query read cannot do that, which is why this module exists
 * alongside `prefersReducedMotion()` rather than replacing it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReducedMotionListener } from './reduced-motion-listener';

type ChangeHandler = (event: { matches: boolean }) => void;

type FakeQuery = {
  matches: boolean;
  addEventListener: (type: string, handler: ChangeHandler) => void;
  removeEventListener: (type: string, handler: ChangeHandler) => void;
  handlers: ChangeHandler[];
};

/** Installs a fake `window.matchMedia` and returns the query plus a restore function. */
function withFakeMatchMedia(initial: boolean): {
  query: FakeQuery;
  queried: string[];
  restore: () => void;
} {
  const queried: string[] = [];
  const query: FakeQuery = {
    matches: initial,
    handlers: [],
    addEventListener(type, handler) {
      if (type === 'change') query.handlers.push(handler);
    },
    removeEventListener(type, handler) {
      if (type === 'change') query.handlers = query.handlers.filter((h) => h !== handler);
    },
  };

  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  globalScope.window = {
    matchMedia: (text: string) => {
      queried.push(text);
      return query;
    },
  };

  return {
    query,
    queried,
    restore: () => {
      if (previous === undefined) delete globalScope.window;
      else globalScope.window = previous;
    },
  };
}

test('reports false where matchMedia is unavailable', () => {
  // Server rendering and the node:test harness. False rather than true is deliberate: a `plain`
  // moment cuts regardless of this gate, so an environment that cannot answer must not suppress
  // ordinary camera movement everywhere.
  const globalScope = globalThis as unknown as { window?: unknown };
  const previous = globalScope.window;
  delete globalScope.window;
  try {
    const listener = createReducedMotionListener();
    assert.equal(listener.matches(), false);
    listener.disconnect();
  } finally {
    if (previous !== undefined) globalScope.window = previous;
  }
});

test('latches the initial preference', () => {
  const fake = withFakeMatchMedia(true);
  try {
    const listener = createReducedMotionListener();
    assert.equal(listener.matches(), true);
    assert.deepEqual(fake.queried, ['(prefers-reduced-motion: reduce)']);
    listener.disconnect();
  } finally {
    fake.restore();
  }
});

test('a preference turned on mid-session is visible without a reload', () => {
  // The whole reason this module is not a one-shot read.
  const fake = withFakeMatchMedia(false);
  try {
    const listener = createReducedMotionListener();
    assert.equal(listener.matches(), false);
    for (const handler of fake.query.handlers) handler({ matches: true });
    assert.equal(listener.matches(), true);
    listener.disconnect();
  } finally {
    fake.restore();
  }
});

test('a preference turned back off is visible too', () => {
  const fake = withFakeMatchMedia(true);
  try {
    const listener = createReducedMotionListener();
    for (const handler of fake.query.handlers) handler({ matches: false });
    assert.equal(listener.matches(), false);
    listener.disconnect();
  } finally {
    fake.restore();
  }
});

test('disconnect removes the subscription', () => {
  // The provider creates one of these per mount. A listener that outlived its provider would keep
  // a closure over a torn-down map alive for the life of the document.
  const fake = withFakeMatchMedia(false);
  try {
    const listener = createReducedMotionListener();
    assert.equal(fake.query.handlers.length, 1);
    listener.disconnect();
    assert.equal(fake.query.handlers.length, 0);
  } finally {
    fake.restore();
  }
});

test('matches() reads the latched value rather than re-querying', () => {
  // The Framed camera path calls this inside a requestAnimationFrame callback, so it must cost a
  // property read. Mutating the query's own `matches` without dispatching a change proves the
  // listener is not reaching back into it on every call.
  const fake = withFakeMatchMedia(false);
  try {
    const listener = createReducedMotionListener();
    fake.query.matches = true;
    assert.equal(listener.matches(), false);
    listener.disconnect();
  } finally {
    fake.restore();
  }
});
