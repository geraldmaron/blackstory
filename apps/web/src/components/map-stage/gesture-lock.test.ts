/**
 * Gesture locking, proven over a fake target.
 *
 * The point of the structural `GestureTarget` type is that this runs under `node:test` with no
 * WebGL and no MapLibre. The asymmetry case below is the one that matters: a handler disabled on
 * entry and forgotten on exit leaves Explore subtly dead, panning but refusing to rotate, with
 * nothing on screen pointing at the cause.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lockGestures, unlockGestures, type GestureTarget } from './gesture-lock';

const GESTURE_NAMES = [
  'scrollZoom',
  'dragPan',
  'dragRotate',
  'touchZoomRotate',
  'doubleClickZoom',
  'keyboard',
] as const;

type FakeTarget = GestureTarget & {
  readonly state: Record<(typeof GESTURE_NAMES)[number], boolean>;
  readonly calls: string[];
};

function createFakeTarget(): FakeTarget {
  const state = Object.fromEntries(
    GESTURE_NAMES.map((name) => [name, true]),
  ) as FakeTarget['state'];
  const calls: string[] = [];
  const handles = Object.fromEntries(
    GESTURE_NAMES.map((name) => [
      name,
      {
        disable: () => {
          state[name] = false;
          calls.push(`${name}.disable`);
        },
        enable: () => {
          state[name] = true;
          calls.push(`${name}.enable`);
        },
      },
    ]),
  ) as Record<(typeof GESTURE_NAMES)[number], { disable: () => void; enable: () => void }>;

  return { ...handles, state, calls } as FakeTarget;
}

test('locking disables every gesture', () => {
  const target = createFakeTarget();
  lockGestures(target);
  for (const name of GESTURE_NAMES) {
    assert.equal(target.state[name], false, `${name} was left enabled on a locked plate`);
  }
});

test('unlocking re-enables every gesture', () => {
  const target = createFakeTarget();
  lockGestures(target);
  unlockGestures(target);
  for (const name of GESTURE_NAMES) {
    assert.equal(target.state[name], true, `${name} was not restored`);
  }
});

test('lock and unlock cover exactly the same handlers', () => {
  // The asymmetry guard. Comparing the two call sets catches a handler added to one function and
  // not the other, which is the failure that leaves a gesture permanently off after one Framed
  // moment has come and gone.
  const locked = createFakeTarget();
  lockGestures(locked);
  const unlocked = createFakeTarget();
  unlockGestures(unlocked);

  const lockedNames = locked.calls.map((call) => call.split('.')[0]).sort();
  const unlockedNames = unlocked.calls.map((call) => call.split('.')[0]).sort();
  assert.deepEqual(lockedNames, unlockedNames);
  assert.equal(lockedNames.length, GESTURE_NAMES.length);
});

test('locking twice is harmless', () => {
  // A moment re-registering re-locks. It must not matter.
  const target = createFakeTarget();
  lockGestures(target);
  lockGestures(target);
  for (const name of GESTURE_NAMES) assert.equal(target.state[name], false);
});

test('a plate locked then unlocked then locked again ends locked', () => {
  const target = createFakeTarget();
  lockGestures(target);
  unlockGestures(target);
  lockGestures(target);
  for (const name of GESTURE_NAMES) assert.equal(target.state[name], false);
});
