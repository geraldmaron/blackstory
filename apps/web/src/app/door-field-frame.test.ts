/**
 * The Door's map window → plate camera arithmetic (repo-18ma2). Two rects in, padding and offset
 * out; no DOM, no MapLibre.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DOOR_FRAME_INSET_MAX_PX,
  DOOR_FRAME_INSET_MIN_PX,
  doorFrameInset,
  doorFrameOffset,
  doorFramePadding,
  sameDoorFrameBox,
} from './door-field-frame';

/** A 1280×720 desktop: the plate is the whole viewport, the window is everything below the bar. */
const DESKTOP_PLATE = { top: 0, left: 0, width: 1280, height: 720 };
const DESKTOP_WINDOW = { top: 84, left: 0, width: 1280, height: 636 };

/** An 820×700 phone-layout viewport: the window is the sticky strip above the chapters. */
const PHONE_PLATE = { top: 0, left: 0, width: 820, height: 700 };
const PHONE_WINDOW = { top: 76, left: 16, width: 788, height: 256 };

test('the desktop window fits the country below the bar, not under it', () => {
  const padding = doorFramePadding(DESKTOP_WINDOW, DESKTOP_PLATE);
  assert.ok(padding);
  // The national preset's own 64px clearance, plus the bar's 84px the window already excludes.
  assert.equal(padding.top, 84 + 64);
  assert.equal(padding.left, 64);
  assert.equal(padding.right, 64);
  assert.equal(padding.bottom, 64);
});

test('the phone strip fits the whole country inside the strip', () => {
  const padding = doorFramePadding(PHONE_WINDOW, PHONE_PLATE);
  assert.ok(padding);
  const inset = doorFrameInset(PHONE_WINDOW);
  assert.equal(inset, 26);
  assert.equal(padding.top, 76 + inset);
  assert.equal(padding.left, 16 + inset);
  assert.equal(padding.right, 16 + inset);
  // Everything below the strip is padding: the chapters scroll over that part of the plate.
  assert.equal(padding.bottom, 700 - (76 + 256) + inset);
});

test('the inset follows the shorter side and stays within its clamps', () => {
  assert.equal(
    doorFrameInset({ top: 0, left: 0, width: 200, height: 100 }),
    DOOR_FRAME_INSET_MIN_PX,
  );
  assert.equal(
    doorFrameInset({ top: 0, left: 0, width: 2000, height: 1200 }),
    DOOR_FRAME_INSET_MAX_PX,
  );
  assert.equal(doorFrameInset({ top: 0, left: 0, width: 1000, height: 400 }), 40);
});

test('a collapsed or unmeasured window is not a frame', () => {
  assert.equal(doorFramePadding({ ...DESKTOP_WINDOW, height: 0 }, DESKTOP_PLATE), null);
  assert.equal(doorFramePadding(DESKTOP_WINDOW, { ...DESKTOP_PLATE, width: 0 }), null);
  assert.equal(doorFramePadding({ ...DESKTOP_WINDOW, top: Number.NaN }, DESKTOP_PLATE), null);
  // A strip too thin to hold the minimum box, once its own inset is taken out.
  assert.equal(doorFramePadding({ top: 76, left: 16, width: 788, height: 60 }, PHONE_PLATE), null);
});

test('a window that overhangs the plate never asks for negative padding', () => {
  const padding = doorFramePadding(
    { top: -20, left: -10, width: 1300, height: 760 },
    DESKTOP_PLATE,
  );
  assert.ok(padding);
  assert.ok(padding.top >= 0 && padding.left >= 0 && padding.right >= 0 && padding.bottom >= 0);
});

test('the offset moves a place from the canvas center to the window center', () => {
  assert.deepEqual(doorFrameOffset(DESKTOP_WINDOW, DESKTOP_PLATE), [0, 42]);
  assert.deepEqual(doorFrameOffset(PHONE_WINDOW, PHONE_PLATE), [0, -146]);
  assert.equal(doorFrameOffset({ ...PHONE_WINDOW, width: 0 }, PHONE_PLATE), null);
});

test('sub-pixel jitter is not a resize', () => {
  assert.ok(sameDoorFrameBox(DESKTOP_WINDOW, { ...DESKTOP_WINDOW, width: 1280.4, top: 83.6 }));
  assert.ok(!sameDoorFrameBox(DESKTOP_WINDOW, { ...DESKTOP_WINDOW, width: 1000 }));
  assert.ok(sameDoorFrameBox(null, null));
  assert.ok(!sameDoorFrameBox(DESKTOP_WINDOW, null));
});
