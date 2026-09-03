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
import {
  applyGesturesForPosture,
  lockGestures,
  lockGesturesAmbient,
  rotateGestureAllowed,
  unlockGestures,
  type GestureTarget,
} from './gesture-lock';
import { wheelRotateDeltaPx } from './custom-rotate-gestures';

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

test('ambient on a coarse (touch) pointer is a full lock: a one-finger drag is the scroll gesture there', () => {
  const target = createFakeTarget();
  lockGesturesAmbient(target, { pointerFine: false });
  for (const name of GESTURE_NAMES) {
    assert.equal(target.state[name], false, `${name} was left enabled on touch ambient`);
  }
});

test('ambient on a precise pointer keeps the wheel off but hands drag, pinch, dblclick and keyboard back', () => {
  const target = createFakeTarget();
  lockGesturesAmbient(target, { pointerFine: true });
  assert.equal(target.state.scrollZoom, false, 'the wheel must always reach the document');
  assert.equal(target.state.dragPan, true);
  assert.equal(target.state.dragRotate, true);
  assert.equal(target.state.touchZoomRotate, true);
  assert.equal(target.state.doubleClickZoom, true);
  assert.equal(target.state.keyboard, true);
});

test('applyGesturesForPosture: live unlocks everything, regardless of pointer', () => {
  const target = createFakeTarget();
  lockGestures(target);
  applyGesturesForPosture(target, 'live', { pointerFine: false });
  for (const name of GESTURE_NAMES) assert.equal(target.state[name], true);
});

test('applyGesturesForPosture: framed and parked are always a full lock, regardless of pointer', () => {
  for (const posture of ['framed', 'parked'] as const) {
    for (const pointerFine of [true, false]) {
      const target = createFakeTarget();
      applyGesturesForPosture(target, posture, { pointerFine });
      for (const name of GESTURE_NAMES) {
        assert.equal(target.state[name], false, `${posture}/pointerFine=${pointerFine}: ${name}`);
      }
    }
  }
});

test('applyGesturesForPosture: ambient defers to the pointer-fine rule', () => {
  const touch = createFakeTarget();
  applyGesturesForPosture(touch, 'ambient', { pointerFine: false });
  assert.equal(touch.state.dragPan, false);

  const mouse = createFakeTarget();
  applyGesturesForPosture(mouse, 'ambient', { pointerFine: true });
  assert.equal(mouse.state.dragPan, true);
  assert.equal(mouse.state.scrollZoom, false);
});

test('rotateGestureAllowed matches dragRotate exactly across every posture/pointer combination', () => {
  // The custom rotate gestures are additional triggers for the same rotation dragRotate already
  // performs — this is the asymmetry guard for that pairing, same shape as the lock/unlock one
  // above.
  for (const posture of ['live', 'ambient', 'framed', 'parked'] as const) {
    for (const pointerFine of [true, false]) {
      const target = createFakeTarget();
      applyGesturesForPosture(target, posture, { pointerFine });
      assert.equal(
        rotateGestureAllowed(posture, { pointerFine }),
        target.state.dragRotate,
        `${posture}/pointerFine=${pointerFine}`,
      );
    }
  }
});

test('a wheel rotation reads the dominant axis, in pixels', () => {
  // A trackpad swipe with Shift held lands on deltaX in some engines and deltaY in others.
  assert.equal(wheelRotateDeltaPx({ deltaX: 40, deltaY: 2 }), 40);
  assert.equal(wheelRotateDeltaPx({ deltaX: -3, deltaY: 26 }), 26);
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: 0 }), 0);
});

test('line and page wheel modes are normalized to pixels', () => {
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: 3, deltaMode: 1 }), 48);
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: 1, deltaMode: 2 }), 400);
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: 12, deltaMode: 0 }), 12);
});

test('a non-finite wheel delta turns nothing', () => {
  assert.equal(wheelRotateDeltaPx({ deltaX: Number.NaN, deltaY: 0 }), 0);
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: Number.POSITIVE_INFINITY }), 0);
});
