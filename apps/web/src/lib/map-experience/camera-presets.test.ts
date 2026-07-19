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
  REDUCED_MOTION_CAMERA_PRESETS,
  cameraPresetFor,
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

test('the point preset lands at a coherent, positive zoom level', () => {
  assert.ok(CAMERA_POINT_ZOOM > 0 && CAMERA_POINT_ZOOM < 22);
});

test('county zoom sits between state resting frame and point framing', () => {
  assert.ok(CAMERA_COUNTY_ZOOM > 6.2 && CAMERA_COUNTY_ZOOM < CAMERA_POINT_ZOOM);
});
