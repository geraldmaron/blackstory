/**
 * The gesture table, proven over a fake target (no WebGL, no MapLibre under `node:test`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyGesturePolicy,
  applyGesturesForPosture,
  gesturePolicyFor,
  lockGestures,
  rotateGestureAllowed,
  type GestureTarget,
} from './gesture-lock';
import { wheelRotateDeltaPx } from './custom-rotate-gestures';

const NAMES = [
  'scrollZoom',
  'dragPan',
  'dragRotate',
  'touchZoomRotate',
  'touchPitch',
  'doubleClickZoom',
  'keyboard',
  'cooperativeGestures',
] as const;
type Name = (typeof NAMES)[number];

function fake(): GestureTarget & { readonly state: Record<Name, boolean> } {
  const state = Object.fromEntries(NAMES.map((n) => [n, true])) as Record<Name, boolean>;
  const handles = Object.fromEntries(
    NAMES.map((n) => [n, { enable: () => (state[n] = true), disable: () => (state[n] = false) }]),
  );
  return { ...(handles as unknown as GestureTarget), state };
}

const on = (t: ReturnType<typeof fake>) => NAMES.filter((n) => t.state[n]).sort();

test('a full-screen map takes every gesture except accidental tilt, never two-finger mode', () => {
  const t = fake();
  applyGesturesForPosture(t, 'live', { pointerFine: false });
  assert.deepEqual(on(t), [
    'doubleClickZoom',
    'dragPan',
    'dragRotate',
    'keyboard',
    'scrollZoom',
    'touchZoomRotate',
  ]);
});

test('on touch, a map that is not full-screen answers nothing — the page scrolls, a tap opens the map', () => {
  for (const posture of ['ambient', 'framed', 'parked'] as const) {
    const t = fake();
    applyGesturesForPosture(t, posture, { pointerFine: false });
    assert.deepEqual(on(t), [], posture);
  }
});

test('the Door backdrop with a mouse: drag and keys, but the wheel stays the page’s', () => {
  const t = fake();
  applyGesturesForPosture(t, 'ambient', { pointerFine: true });
  assert.deepEqual(on(t), ['doubleClickZoom', 'dragPan', 'dragRotate', 'keyboard']);
});

test('every apply writes every handler, so no posture inherits a stale one', () => {
  const t = fake();
  applyGesturePolicy(t, 'reader');
  lockGestures(t);
  assert.deepEqual(on(t), []);
  applyGesturePolicy(t, 'reader');
  assert.equal(t.state.cooperativeGestures, false);
});

test('policy table', () => {
  assert.equal(gesturePolicyFor('live', { pointerFine: true }), 'reader');
  assert.equal(gesturePolicyFor('ambient', { pointerFine: true }), 'backdrop');
  assert.equal(gesturePolicyFor('ambient', { pointerFine: false }), 'off');
  assert.equal(gesturePolicyFor('framed', { pointerFine: true }), 'off');
});

test('desktop rotate extras never attach on touch, where they hijacked iPhone pinch', () => {
  assert.equal(rotateGestureAllowed('live', { pointerFine: false }), false);
  assert.equal(rotateGestureAllowed('live', { pointerFine: true }), true);
  assert.equal(rotateGestureAllowed('ambient', { pointerFine: true }), true);
  assert.equal(rotateGestureAllowed('framed', { pointerFine: true }), false);
});

test('wheel rotate delta normalizes line and page modes', () => {
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: 10 }), 10);
  assert.equal(wheelRotateDeltaPx({ deltaX: 0, deltaY: 2, deltaMode: 1 }), 32);
  assert.equal(wheelRotateDeltaPx({ deltaX: -5, deltaY: 1 }), -5);
});
