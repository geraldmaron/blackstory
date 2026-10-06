import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyEmbeddedGestures,
  fixedBoxFor,
  type EmbedGestureTarget,
} from './embedded-map-gestures';

function fake() {
  const state: Record<string, boolean> = {};
  const h = (name: string) => ({
    enable: () => (state[name] = true),
    disable: () => (state[name] = false),
  });
  const target = {
    cooperativeGestures: h('cooperative'),
    dragPan: h('dragPan'),
    scrollZoom: h('scrollZoom'),
    doubleClickZoom: h('doubleClickZoom'),
    keyboard: h('keyboard'),
    dragRotate: h('dragRotate'),
    touchPitch: h('touchPitch'),
    touchZoomRotate: { ...h('touchZoomRotate'), disableRotation: () => (state.rotation = false) },
  } satisfies EmbedGestureTarget;
  return { target, state };
}

test('in the page: MapLibre cooperative mode — one finger is the page’s, two fingers are the map’s', () => {
  const { target, state } = fake();
  applyEmbeddedGestures(target, false);
  assert.equal(state.cooperative, true);
  assert.equal(state.dragPan, true);
  assert.equal(state.touchZoomRotate, true);
});

test('full screen: every gesture, one finger pans', () => {
  const { target, state } = fake();
  applyEmbeddedGestures(target, true);
  assert.equal(state.cooperative, false);
  assert.equal(state.dragPan, true);
});

test('never tilts or twists, in either state', () => {
  for (const expanded of [false, true]) {
    const { target, state } = fake();
    applyEmbeddedGestures(target, expanded);
    assert.equal(state.touchPitch, false);
    assert.equal(state.dragRotate, false);
    assert.equal(state.rotation, false);
  }
});

test('the expand animation starts from the slot’s own box', () => {
  assert.deepEqual(fixedBoxFor({ top: 120, left: 16, width: 358, height: 186 }), {
    top: '120px',
    left: '16px',
    width: '358px',
    height: '186px',
  });
});
