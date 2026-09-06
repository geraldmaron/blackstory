/**
 * The Door's map window → plate camera arithmetic (repo-18ma2). Rects in, padding and offset
 * out; no DOM, no MapLibre.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DOOR_FRAME_MARGIN_MAX_PX,
  DOOR_FRAME_MARGIN_MIN_PX,
  doorFrameMargin,
  doorFrameOffset,
  doorFramePadding,
  sameDoorFrameBox,
} from './door-field-frame';

/** A 1280×720 desktop: the plate is the whole viewport, the window is everything below the bar. */
const DESKTOP_PLATE = { top: 0, left: 0, width: 1280, height: 720 };
const DESKTOP_WINDOW = { top: 84, left: 0, width: 1280, height: 636 };
/** The pin count and rotate hint, laid along the top of the desktop window. */
const DESKTOP_CHROME = { top: 100, left: 20, width: 560, height: 28 };

/** An 820×700 phone-layout viewport: the window is the sticky strip above the chapters. */
const PHONE_PLATE = { top: 0, left: 0, width: 820, height: 700 };
const PHONE_WINDOW = { top: 76, left: 16, width: 788, height: 256 };
/** Hidden chrome measures as nothing. */
const HIDDEN_CHROME = { top: 0, left: 0, width: 0, height: 0 };

test('the desktop window fits the country below the bar and below the field chrome', () => {
  const padding = doorFramePadding(DESKTOP_WINDOW, DESKTOP_PLATE, DESKTOP_CHROME);
  assert.ok(padding);
  // The bar the window already excludes, the chrome band inside the window, then the margin.
  assert.equal(padding.top, 84 + (128 - 84) + 32);
  assert.equal(padding.left, 32);
  assert.equal(padding.right, 32);
  assert.equal(padding.bottom, 32);
});

test('without chrome the country only keeps its margin from the bar', () => {
  const padding = doorFramePadding(DESKTOP_WINDOW, DESKTOP_PLATE);
  assert.ok(padding);
  assert.equal(padding.top, 84 + 32);
  assert.deepEqual(doorFramePadding(DESKTOP_WINDOW, DESKTOP_PLATE, HIDDEN_CHROME), padding);
});

test('the phone strip fits the whole country inside the strip', () => {
  const padding = doorFramePadding(PHONE_WINDOW, PHONE_PLATE, HIDDEN_CHROME);
  assert.ok(padding);
  const margin = doorFrameMargin(PHONE_WINDOW);
  assert.equal(margin, 13);
  assert.equal(padding.top, 76 + margin);
  assert.equal(padding.left, 16 + margin);
  assert.equal(padding.right, 16 + margin);
  // Everything below the strip is padding: the chapters scroll over that part of the plate.
  assert.equal(padding.bottom, 700 - (76 + 256) + margin);
});

test('the margin follows the shorter side and stays within its clamps', () => {
  assert.equal(
    doorFrameMargin({ top: 0, left: 0, width: 200, height: 100 }),
    DOOR_FRAME_MARGIN_MIN_PX,
  );
  assert.equal(
    doorFrameMargin({ top: 0, left: 0, width: 2000, height: 1200 }),
    DOOR_FRAME_MARGIN_MAX_PX,
  );
  assert.equal(doorFrameMargin({ top: 0, left: 0, width: 1000, height: 400 }), 20);
});

test('a collapsed or unmeasured window is not a frame', () => {
  assert.equal(doorFramePadding({ ...DESKTOP_WINDOW, height: 0 }, DESKTOP_PLATE), null);
  assert.equal(doorFramePadding(DESKTOP_WINDOW, { ...DESKTOP_PLATE, width: 0 }), null);
  assert.equal(doorFramePadding({ ...DESKTOP_WINDOW, top: Number.NaN }, DESKTOP_PLATE), null);
  // A strip too thin to hold the minimum box, once its own margin is taken out.
  assert.equal(doorFramePadding({ top: 76, left: 16, width: 788, height: 40 }, PHONE_PLATE), null);
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
