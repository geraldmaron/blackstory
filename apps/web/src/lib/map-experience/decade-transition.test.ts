import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DECADE_TRANSITION_MS,
  DECADE_TRANSITION_PAINT,
  decadesBetween,
  sweep,
  SWEEP_STEP_MS,
  SWEEP_STEP_REDUCED_MS,
  sweepIntervalMs,
} from './decade-transition';

/** Runs a sweep with a controllable clock so no test waits on a real timer. */
function fakeClock() {
  const queue: { id: number; run: () => void }[] = [];
  let nextId = 1;
  return {
    scheduler: (callback: () => void, _delayMs: number) => {
      const id = nextId++;
      queue.push({ id, run: callback });
      return id;
    },
    cancelScheduled: (handle: unknown) => {
      const index = queue.findIndex((entry) => entry.id === handle);
      if (index >= 0) queue.splice(index, 1);
    },
    /** Drains the queue, with a hard stop so a non-terminating sweep fails rather than hangs. */
    drain: (limit = 200) => {
      let steps = 0;
      while (queue.length > 0 && steps < limit) {
        queue.shift()?.run();
        steps += 1;
      }
      return steps;
    },
    pending: () => queue.length,
  };
}

test('the pin layers carry a real crossfade, not a snap', () => {
  assert.equal(DECADE_TRANSITION_MS, 420);
  assert.deepEqual(DECADE_TRANSITION_PAINT['circle-opacity-transition'], { duration: 420 });
  assert.deepEqual(DECADE_TRANSITION_PAINT['circle-stroke-opacity-transition'], { duration: 420 });
});

test('decadesBetween is chronological and inclusive at both ends', () => {
  assert.deepEqual(decadesBetween(1900, 1940), [1900, 1910, 1920, 1930, 1940]);
  assert.deepEqual(decadesBetween(1900, 1900), [1900]);
});

test('a reversed range still runs forwards in time', () => {
  assert.deepEqual(decadesBetween(1940, 1900), [1900, 1910, 1920, 1930, 1940]);
});

test('a non-finite range produces no decades rather than an infinite loop', () => {
  assert.deepEqual(decadesBetween(Number.NaN, 1900), []);
  assert.deepEqual(decadesBetween(1900, Number.POSITIVE_INFINITY), []);
});

test('reduced motion slows the sweep instead of disabling it', () => {
  assert.equal(sweepIntervalMs(false), SWEEP_STEP_MS);
  assert.equal(sweepIntervalMs(true), SWEEP_STEP_REDUCED_MS);
  assert.ok(SWEEP_STEP_REDUCED_MS > SWEEP_STEP_MS);
});

test('the sweep emits every decade in order and terminates', () => {
  const clock = fakeClock();
  const seen: number[] = [];
  let done = false;

  sweep({
    from: 1900,
    to: 1950,
    onDecade: (decade) => seen.push(decade),
    onDone: () => {
      done = true;
    },
    scheduler: clock.scheduler,
    cancelScheduled: clock.cancelScheduled,
  });
  clock.drain();

  assert.deepEqual(seen, [1900, 1910, 1920, 1930, 1940, 1950]);
  assert.equal(done, true);
  assert.equal(clock.pending(), 0, 'the sweep left a timer running');
});

test('the first decade lands immediately, so play does not read as a stall', () => {
  const clock = fakeClock();
  const seen: number[] = [];
  sweep({
    from: 1900,
    to: 1930,
    onDecade: (decade) => seen.push(decade),
    scheduler: clock.scheduler,
    cancelScheduled: clock.cancelScheduled,
  });
  assert.deepEqual(seen, [1900]);
});

test('the sweep uses the reduced-motion interval when asked', () => {
  const delays: number[] = [];
  sweep({
    from: 1900,
    to: 1920,
    reducedMotion: true,
    onDecade: () => {},
    scheduler: (_callback, delayMs) => {
      delays.push(delayMs);
      return 0;
    },
    cancelScheduled: () => {},
  });
  assert.deepEqual(delays, [SWEEP_STEP_REDUCED_MS]);
});

test('cancel stops the sweep and leaves no timer behind', () => {
  const clock = fakeClock();
  const seen: number[] = [];
  const handle = sweep({
    from: 1630,
    to: 2020,
    onDecade: (decade) => seen.push(decade),
    scheduler: clock.scheduler,
    cancelScheduled: clock.cancelScheduled,
  });

  assert.equal(handle.isRunning(), true);
  handle.cancel();
  clock.drain();

  assert.deepEqual(seen, [1630], 'a cancelled sweep kept emitting');
  assert.equal(handle.isRunning(), false);
  assert.equal(clock.pending(), 0);
});

test('cancelling a finished sweep is safe', () => {
  const clock = fakeClock();
  const handle = sweep({
    from: 1900,
    to: 1900,
    onDecade: () => {},
    scheduler: clock.scheduler,
    cancelScheduled: clock.cancelScheduled,
  });
  clock.drain();
  handle.cancel();
  assert.equal(handle.isRunning(), false);
});

test('a sweep over the whole release terminates', () => {
  const clock = fakeClock();
  let count = 0;
  sweep({
    from: 1630,
    to: 2020,
    onDecade: () => {
      count += 1;
    },
    scheduler: clock.scheduler,
    cancelScheduled: clock.cancelScheduled,
  });
  clock.drain(500);
  assert.equal(count, 40, '1630s to 2020s is 40 decades');
  assert.equal(clock.pending(), 0);
});
