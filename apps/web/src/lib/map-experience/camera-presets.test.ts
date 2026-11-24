/**
 * Confirms the camera grammar's shape, authored duration/curve ranges (design-direction-v3.md
 * "Camera grammar ()"), the slow-out easing curve's monotonic descent-into-place shape,
 * and that the reduced-motion table maps every preset to an instant jump (duration 0).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAMERA_EASING_SLOW_OUT,
  CAMERA_COUNTY_ZOOM,
  CAMERA_POINT_ZOOM,
  CAMERA_PRESETS,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  REDUCED_MOTION_CAMERA_PRESETS,
  cameraPresetFor,
  flightDurationFor,
  flightPeakZoom,
  screensBetween,
  type CameraPresetName,
} from './camera-presets';

const PRESET_NAMES: readonly CameraPresetName[] = ['national', 'state', 'locality', 'point'];

test('every preset carries duration, curve, speed, easing, and padding', () => {
  for (const name of PRESET_NAMES) {
    const preset = CAMERA_PRESETS[name];
    assert.equal(typeof preset.duration, 'number');
    assert.equal(typeof preset.curve, 'number');
    assert.equal(typeof preset.speed, 'number');
    assert.equal(typeof preset.padding, 'number');
    assert.equal(typeof preset.easing, 'function');
  }
});

test('national and state durations fall in the authored 2000-2600ms range', () => {
  assert.ok(CAMERA_PRESETS.national.duration >= 2000 && CAMERA_PRESETS.national.duration <= 2600);
  assert.ok(CAMERA_PRESETS.state.duration >= 2000 && CAMERA_PRESETS.state.duration <= 2600);
});

test('the locality duration is close to the authored ~1600ms', () => {
  assert.ok(CAMERA_PRESETS.locality.duration >= 1400 && CAMERA_PRESETS.locality.duration <= 1800);
});

test('the point duration is close to the authored ~1200ms', () => {
  assert.ok(CAMERA_PRESETS.point.duration >= 1000 && CAMERA_PRESETS.point.duration <= 1400);
});

test('every preset curve falls in the authored 1.32-1.42 range', () => {
  for (const name of PRESET_NAMES) {
    const { curve } = CAMERA_PRESETS[name];
    assert.ok(curve >= 1.32 && curve <= 1.42, `${name} curve ${curve} out of range`);
  }
});

test('deeper descent tiers fly in shorter durations: national >= state >= locality >= point', () => {
  assert.ok(CAMERA_PRESETS.national.duration >= CAMERA_PRESETS.state.duration);
  assert.ok(CAMERA_PRESETS.state.duration >= CAMERA_PRESETS.locality.duration);
  assert.ok(CAMERA_PRESETS.locality.duration >= CAMERA_PRESETS.point.duration);
});

test('padding tightens as the descent gets more specific', () => {
  assert.ok(CAMERA_PRESETS.national.padding >= CAMERA_PRESETS.state.padding);
  assert.ok(CAMERA_PRESETS.state.padding >= CAMERA_PRESETS.locality.padding);
  assert.ok(CAMERA_PRESETS.locality.padding >= CAMERA_PRESETS.point.padding);
});

test('the shared slow-out easing starts at 0, ends at 1, and never runs backwards', () => {
  assert.ok(Math.abs(CAMERA_EASING_SLOW_OUT(0)) < 1e-6);
  assert.ok(Math.abs(CAMERA_EASING_SLOW_OUT(1) - 1) < 1e-6);
  let previous = -Infinity;
  for (let t = 0; t <= 1; t += 0.05) {
    const value = CAMERA_EASING_SLOW_OUT(t);
    assert.ok(value >= previous - 1e-6, `easing regressed at t=${t}`);
    previous = value;
  }
});

test('the slow-out curve is genuinely slow-out: it runs well ahead of a linear ramp', () => {
  // "Slow-out" (ease-out) motion covers most of its distance early and settles late; sampled at
  // the midpoint, that means running well ahead of a plain linear 1:1 ramp.
  assert.ok(CAMERA_EASING_SLOW_OUT(0.5) > 0.9);
});

test('reduced-motion variant maps every preset to duration 0 (an instant jump, not a flight)', () => {
  for (const name of PRESET_NAMES) {
    assert.equal(REDUCED_MOTION_CAMERA_PRESETS[name].duration, 0);
    // Padding is landing framing, not motion — it survives into the instant-jump variant.
    assert.equal(REDUCED_MOTION_CAMERA_PRESETS[name].padding, CAMERA_PRESETS[name].padding);
  }
});

test('cameraPresetFor selects the reduced-motion table only when asked', () => {
  assert.equal(cameraPresetFor('state', false), CAMERA_PRESETS.state);
  assert.equal(cameraPresetFor('state', true), REDUCED_MOTION_CAMERA_PRESETS.state);
});

test('map zoom envelope is national floor to street-orientation ceiling', () => {
  assert.equal(MAP_MIN_ZOOM, 3);
  assert.equal(MAP_MAX_ZOOM, 14);
  assert.ok(MAP_MIN_ZOOM < MAP_MAX_ZOOM);
});

test('the point preset lands inside the map zoom envelope', () => {
  assert.ok(CAMERA_POINT_ZOOM > MAP_MIN_ZOOM);
  assert.ok(CAMERA_POINT_ZOOM <= MAP_MAX_ZOOM);
});

test('county zoom sits between state resting frame and point framing', () => {
  assert.ok(CAMERA_COUNTY_ZOOM > 6.2 && CAMERA_COUNTY_ZOOM < CAMERA_POINT_ZOOM);
});

test('a flight is stretched to the distance it covers, within the preset and the cap', () => {
  const point = CAMERA_PRESETS.point.duration;
  // A landing from the city it is already over keeps the authored duration.
  assert.equal(flightDurationFor(point, 11, 13, 0.5), point);
  // The globe down to a street, and one city to another across the country, get longer.
  assert.ok(flightDurationFor(point, 1.4, 13, 0) > 3000);
  assert.ok(flightDurationFor(point, 14, 14, 800) > 2500);
  // Never past the cap, and a map with no size yet falls back to the preset.
  assert.equal(flightDurationFor(point, 0, 22, 1e9), 3200);
  assert.equal(flightDurationFor(point, Number.NaN, 13, 0), point);
});

test('a flight pulls out by distance: barely for a neighbor, to the country for the far coast', () => {
  // A few blocks away at street level: the arc hardly lifts.
  assert.ok(flightPeakZoom(13, 13, 0.3) > 12.5);
  // Across a city: out until both ends fit.
  const acrossTown = flightPeakZoom(13, 13, 6);
  assert.ok(acrossTown < 11 && acrossTown > 9.5);
  // Across the country from a street: out to the country, never to the globe.
  assert.equal(flightPeakZoom(13, 13, 900), 3.3);
  // From the globe down to a street there is nothing to pull out to: it only descends.
  assert.equal(flightPeakZoom(1.88, 13, 0), 1.88);
  assert.equal(flightPeakZoom(1.88, 13, 0.2) <= 1.88, true);
  // The trip is measured at the wider end, so a climb to the country does not overshoot it.
  assert.ok(flightPeakZoom(13, 5, 300) >= 3.3);
  assert.equal(flightPeakZoom(Number.NaN, 13, 2), 13);
});

test('screensBetween sizes a trip in map widths at the camera zoom', () => {
  const here = { lng: -96, lat: 38 };
  assert.equal(screensBetween(here, [-96, 38], 10, 1000), 0);
  // The same trip is twice as many screens one zoom level closer.
  const far = screensBetween(here, [-80, 38], 10, 1000);
  assert.ok(Math.abs(screensBetween(here, [-80, 38], 11, 1000) / far - 2) < 1e-9);
  // A map with no size yet never yields a non-finite trip.
  assert.ok(Number.isFinite(screensBetween(here, [-80, 38], 10, 0)));
});
