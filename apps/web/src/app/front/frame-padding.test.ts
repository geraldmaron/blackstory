/**
 * The Door's map window → plate camera arithmetic. Rects in, padding and offset
 * out; no DOM, no MapLibre.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FRAME_MARGIN_MAX_PX,
  FRAME_MARGIN_MIN_PX,
  frameMargin,
  framePadding,
} from './frame-padding';

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
  const padding = framePadding(DESKTOP_WINDOW, DESKTOP_PLATE, DESKTOP_CHROME);
  assert.ok(padding);
  // The bar the window already excludes, the chrome band inside the window, then the margin.
  assert.equal(padding.top, 84 + (128 - 84) + 32);
  assert.equal(padding.left, 32);
  assert.equal(padding.right, 32);
  assert.equal(padding.bottom, 32);
});

test('without chrome the country only keeps its margin from the bar', () => {
  const padding = framePadding(DESKTOP_WINDOW, DESKTOP_PLATE);
  assert.ok(padding);
  assert.equal(padding.top, 84 + 32);
  assert.equal(padding.bottom, 32);
  assert.deepEqual(framePadding(DESKTOP_WINDOW, DESKTOP_PLATE, HIDDEN_CHROME), padding);
});

test('wide and laptop desktop openings use the full centered window behind the introduction', () => {
  for (const [width, height] of [
    [1728, 906],
    [1280, 720],
    [900, 700],
  ] as const) {
    const plate = { top: 0, left: 0, width, height };
    const window = { top: 84, left: 0, width, height: height - 84 };
    const chrome = { top: 100, left: 20, width: width - 40, height: 44 };
    const padding = framePadding(window, plate, chrome);
    assert.ok(padding);
    assert.equal(padding.left, padding.right, 'the national view stays horizontally centered');
    assert.equal(padding.bottom, frameMargin(window), 'copy does not reserve a bottom band');
    assert.equal(padding.top, 144 + frameMargin(window));
    assert.ok(height - padding.top - padding.bottom > height / 2);
  }
});

test('the phone strip fits the whole country inside the strip', () => {
  const padding = framePadding(PHONE_WINDOW, PHONE_PLATE, HIDDEN_CHROME);
  assert.ok(padding);
  const margin = frameMargin(PHONE_WINDOW);
  assert.equal(margin, 13);
  assert.equal(padding.top, 76 + margin);
  assert.equal(padding.left, 16 + margin);
  assert.equal(padding.right, 16 + margin);
  // Everything below the strip is padding: the chapters scroll over that part of the plate.
  assert.equal(padding.bottom, 700 - (76 + 256) + margin);
});

test('the margin follows the shorter side and stays within its clamps', () => {
  assert.equal(frameMargin({ top: 0, left: 0, width: 200, height: 100 }), FRAME_MARGIN_MIN_PX);
  assert.equal(frameMargin({ top: 0, left: 0, width: 2000, height: 1200 }), FRAME_MARGIN_MAX_PX);
  assert.equal(frameMargin({ top: 0, left: 0, width: 1000, height: 400 }), 20);
});

test('a collapsed or unmeasured window is not a frame', () => {
  assert.equal(framePadding({ ...DESKTOP_WINDOW, height: 0 }, DESKTOP_PLATE), null);
  assert.equal(framePadding(DESKTOP_WINDOW, { ...DESKTOP_PLATE, width: 0 }), null);
  assert.equal(framePadding({ ...DESKTOP_WINDOW, top: Number.NaN }, DESKTOP_PLATE), null);
  // A strip too thin to hold the minimum box, once its own margin is taken out.
  assert.equal(framePadding({ top: 76, left: 16, width: 788, height: 40 }, PHONE_PLATE), null);
});

test('a window that overhangs the plate never asks for negative padding', () => {
  const padding = framePadding({ top: -20, left: -10, width: 1300, height: 760 }, DESKTOP_PLATE);
  assert.ok(padding);
  assert.ok(padding.top >= 0 && padding.left >= 0 && padding.right >= 0 && padding.bottom >= 0);
});
