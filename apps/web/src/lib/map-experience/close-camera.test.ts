/**
 * Unit tests for hierarchical close-camera bounce-back (county → state → country).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { CAMERA_COUNTY_ZOOM } from './camera-presets';
import {
  CLOSE_BEYOND_COUNTY_ZOOM,
  CLOSE_STATE_SCALE_ZOOM,
  resolveCloseCameraTarget,
} from './close-camera';
import { viewportForState } from './url-state';

const CHICAGO: readonly [number, number] = [-87.6298, 41.8781];

test('beyond-county pre-select eases to county framing on the pin', () => {
  const target = resolveCloseCameraTarget({
    preSelectViewport: { lat: 41.88, lng: -87.63, zoom: 10 },
    entityCenter: CHICAGO,
  });
  assert.equal(target.preset, 'locality');
  if (target.preset !== 'locality') return;
  assert.deepEqual(target.center, CHICAGO);
  assert.equal(target.zoom, CAMERA_COUNTY_ZOOM);
});

test('point-zoom stash (above county threshold) also lands on county', () => {
  const target = resolveCloseCameraTarget({
    preSelectViewport: { lat: 41.88, lng: -87.63, zoom: CLOSE_BEYOND_COUNTY_ZOOM + 0.1 },
    entityCenter: CHICAGO,
  });
  assert.equal(target.preset, 'locality');
});

test('state-scale pre-select without filter eases to inferred state', () => {
  const il = viewportForState('IL');
  assert.ok(il);
  const target = resolveCloseCameraTarget({
    preSelectViewport: { lat: 41.88, lng: -87.63, zoom: 6.0 },
    entityCenter: CHICAGO,
  });
  assert.equal(target.preset, 'state');
  if (target.preset !== 'state') return;
  assert.equal(target.zoom, il!.zoom);
  assert.ok(Math.abs(target.center[0] - il!.lng) < 0.01);
  assert.ok(Math.abs(target.center[1] - il!.lat) < 0.01);
});

test('active state filter wins at state-scale even when pin is elsewhere', () => {
  const ga = viewportForState('GA');
  assert.ok(ga);
  const target = resolveCloseCameraTarget({
    preSelectViewport: { lat: 33.75, lng: -84.39, zoom: CLOSE_STATE_SCALE_ZOOM },
    entityCenter: CHICAGO,
    stateFilter: 'GA',
  });
  assert.equal(target.preset, 'state');
  if (target.preset !== 'state') return;
  assert.equal(target.zoom, ga!.zoom);
});

test('below-state-scale pre-select restores the stashed viewport', () => {
  const preSelect = { lat: 37.9, lng: -95.8, zoom: 4.29 };
  const target = resolveCloseCameraTarget({
    preSelectViewport: preSelect,
    entityCenter: CHICAGO,
  });
  assert.equal(target.preset, 'locality');
  if (target.preset !== 'locality') return;
  assert.equal(target.center[0], preSelect.lng);
  assert.equal(target.center[1], preSelect.lat);
  assert.equal(target.zoom, preSelect.zoom);
});

test('below-state-scale pre-select without a pin still restores the stashed viewport', () => {
  const preSelect = { lat: 37.9, lng: -95.8, zoom: 3.5 };
  const target = resolveCloseCameraTarget({ preSelectViewport: preSelect });
  assert.equal(target.preset, 'locality');
  if (target.preset !== 'locality') return;
  assert.equal(target.zoom, preSelect.zoom);
});

test('state-scale inference failure with a pin lands on county (not CONUS)', () => {
  const target = resolveCloseCameraTarget({
    preSelectViewport: { lat: 41.88, lng: -87.63, zoom: 6.0 },
    entityCenter: [0, 0] as const,
  });
  assert.equal(target.preset, 'locality');
  if (target.preset !== 'locality') return;
  assert.equal(target.zoom, CAMERA_COUNTY_ZOOM);
});

test('missing pre-select with a pin defaults to county (not national)', () => {
  const target = resolveCloseCameraTarget({ entityCenter: CHICAGO });
  assert.equal(target.preset, 'locality');
  if (target.preset !== 'locality') return;
  assert.equal(target.zoom, CAMERA_COUNTY_ZOOM);
});

test('state filter with no pin still returns that state frame', () => {
  const target = resolveCloseCameraTarget({
    preSelectViewport: { lat: 37.9, lng: -95.8, zoom: 4.29 },
    stateFilter: 'IL',
  });
  // National zoom → national wins over filter? Spec: filter is explicit context.
  // Beyond-county is false; state filter should still apply when present.
  assert.equal(target.preset, 'state');
});

test('no context at all falls back to national', () => {
  const target = resolveCloseCameraTarget({});
  assert.equal(target.preset, 'national');
  if (target.preset !== 'national') return;
  assert.deepEqual(target.bounds, US_CONUS_BOUNDS);
});
