/**
 * The tour's scroll scrub: a scroll position is a camera, continuous and reversible.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TOUR_HOLD_SCREENS,
  TOUR_STOP_SCREENS,
  tourCameraAt,
  tourDive,
  tourNearestStop,
  tourPhase,
  type TourCamera,
  type TourCameras,
} from './door-tour-scrub';

const SCREEN = 900;
const LAYOUT = { top: 848, screen: SCREEN, count: 3 };
const SECTION = TOUR_STOP_SCREENS * SCREEN;
const stopTop = (index: number) => LAYOUT.top + index * SECTION;
const END = stopTop(LAYOUT.count);

const pad = (left: number) => ({ top: 56, right: 0, bottom: 0, left });
const CAMERAS: TourCameras = {
  opening: { center: [-96, 36], zoom: 1.8, pitch: 0, padding: pad(500) },
  orbit: { center: [-96, 36], zoom: 1.88, pitch: 0, padding: pad(0) },
  stops: [
    { center: [-72.5, 42.4], zoom: 14, pitch: 45, padding: pad(700) },
    { center: [-77, 38.9], zoom: 14, pitch: 45, padding: pad(700) },
    { center: [-122.4, 37.8], zoom: 10, pitch: 0, padding: pad(700) },
  ],
};

test('above the tour and past its end the opening has the map', () => {
  assert.equal(tourPhase(0, LAYOUT).active, false);
  assert.equal(tourPhase(10, LAYOUT).active, false);
  assert.equal(tourPhase(END, LAYOUT).active, false);
  assert.equal(tourPhase(END + 5000, LAYOUT).active, false);
  assert.equal(tourCameraAt(tourPhase(0, LAYOUT), CAMERAS), null);
  // No tour, or a layout that has not been measured yet, is never active.
  assert.equal(tourPhase(500, { top: 848, screen: SCREEN, count: 0 }).active, false);
  assert.equal(tourPhase(500, { top: 848, screen: 0, count: 3 }).active, false);
});

test('a stop holds for its first screens, with its words, then the camera travels', () => {
  for (let index = 0; index < LAYOUT.count; index += 1) {
    const top = stopTop(index);
    for (const y of [top, top + 1, top + TOUR_HOLD_SCREENS * SCREEN - 1]) {
      const phase = tourPhase(y, LAYOUT);
      assert.equal(phase.from, index + 1, `stop ${index} at ${y}`);
      assert.equal(phase.to, index + 1);
      assert.equal(phase.words, index);
      assert.deepEqual(tourCameraAt(phase, CAMERAS), CAMERAS.stops[index]);
    }
    const travelling = tourPhase(top + (TOUR_HOLD_SCREENS + 0.6) * SCREEN, LAYOUT);
    assert.equal(travelling.words, null, 'the stage is clear mid-travel');
    assert.ok(travelling.t > 0 && travelling.t < 1);
  }
});

test('between two stops the camera goes out to the globe and comes down on the next', () => {
  const start = stopTop(0) + TOUR_HOLD_SCREENS * SCREEN;
  const leg = SECTION - TOUR_HOLD_SCREENS * SCREEN;
  const mid = tourCameraAt(tourPhase(start + leg / 2, LAYOUT), CAMERAS)!;
  assert.ok(Math.abs(mid.zoom - CAMERAS.orbit.zoom) < 0.01, 'at the globe halfway');
  assert.equal(mid.pitch, 0);
  assert.deepEqual(mid.padding, CAMERAS.orbit.padding);
  // The zoom falls the whole first half and rises the whole second half.
  let last = Infinity;
  for (let k = 0; k <= 0.5; k += 0.05) {
    const zoom = tourCameraAt(tourPhase(start + leg * k + 0.001, LAYOUT), CAMERAS)!.zoom;
    assert.ok(zoom <= last + 1e-9, `falling at ${k}`);
    last = zoom;
  }
  for (let k = 0.5; k < 1; k += 0.05) {
    const zoom = tourCameraAt(tourPhase(start + leg * k, LAYOUT), CAMERAS)!.zoom;
    assert.ok(zoom >= last - 1e-9, `rising at ${k}`);
    last = zoom;
  }
});

test('the path has no jump: a pixel of scroll never moves the camera more than a little', () => {
  let previous: TourCamera | null = null;
  for (let y = 40; y < END; y += 1) {
    const camera = tourCameraAt(tourPhase(y, LAYOUT), CAMERAS)!;
    if (previous) {
      assert.ok(Math.abs(camera.zoom - previous.zoom) < 0.05, `zoom at ${y}`);
      assert.ok(Math.abs(camera.center[0] - previous.center[0]) < 0.4, `lng at ${y}`);
      assert.ok(Math.abs(camera.pitch - previous.pitch) < 0.5, `pitch at ${y}`);
      assert.ok(Math.abs(camera.padding.left - previous.padding.left) < 6, `padding at ${y}`);
    }
    previous = camera;
  }
});

test('the tour starts and ends on the opening globe, so the hand-over is seamless', () => {
  const entering = tourCameraAt(tourPhase(40, LAYOUT), CAMERAS)!;
  assert.ok(Math.abs(entering.zoom - CAMERAS.opening.zoom) < 0.1);
  assert.ok(Math.abs(entering.padding.left - CAMERAS.opening.padding.left) < 1);
  const leaving = tourCameraAt(tourPhase(END - 1, LAYOUT), CAMERAS)!;
  assert.ok(Math.abs(leaving.zoom - CAMERAS.opening.zoom) < 0.01);
  assert.ok(Math.abs(leaving.center[0] - CAMERAS.opening.center[0]) < 0.01);
  // The first stop's words arrive as the dive lands, not before.
  assert.equal(tourPhase(LAYOUT.top * 0.5, LAYOUT).words, null);
  assert.equal(tourPhase(LAYOUT.top - 2, LAYOUT).words, 0);
  // Nothing follows the last stop, so no words wait at the end of its pull-out.
  assert.equal(tourPhase(END - 2, LAYOUT).words, null);
});

test('a dive turns the globe to the place before it comes down, and tilts last', () => {
  const landing = CAMERAS.stops[0]!;
  const early = tourDive(CAMERAS.orbit, landing, 0.45);
  assert.deepEqual(early.center, landing.center, 'facing the place by 45% of the way');
  assert.equal(early.pitch, 0, 'still looking straight down');
  assert.ok(early.zoom < (CAMERAS.orbit.zoom + landing.zoom) / 2);
  assert.deepEqual(tourDive(CAMERAS.orbit, landing, 1), landing);
  assert.deepEqual(tourDive(CAMERAS.orbit, landing, 0), CAMERAS.orbit);
});

test('the nearest stop is the one the camera is on or closer to', () => {
  assert.equal(tourNearestStop(tourPhase(0, LAYOUT), 3), null);
  assert.equal(tourNearestStop(tourPhase(LAYOUT.top * 0.2, LAYOUT), 3), null);
  assert.equal(tourNearestStop(tourPhase(LAYOUT.top * 0.8, LAYOUT), 3), 0);
  assert.equal(tourNearestStop(tourPhase(stopTop(1) + 10, LAYOUT), 3), 1);
  assert.equal(tourNearestStop(tourPhase(END - 10, LAYOUT), 3), null);
});
