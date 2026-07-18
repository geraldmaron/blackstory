/**
 * Confirms the BB-099 state-label data layer: all 51 states + D.C. get a label point, the
 * documented AK/HI/FL/MI overrides are actually applied (not silently ignored), the zoom-fade
 * curve matches design-direction-v3.md's band (visible <= 5.6, gone >= 6.2), and selection
 * toggles exactly one descriptor without moving any label.
 *
 * `buildStateLabelElement` (browser-only, calls `document.createElement`) is intentionally not
 * exercised here plain Node has no DOM; see that function's doc comment in `state-labels.ts`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { US_STATES } from '@blap/domain';
import {
  STATE_LABEL_FADE_END_ZOOM,
  STATE_LABEL_FADE_START_ZOOM,
  buildStateLabelMarkers,
  stateLabelOpacityForZoom,
  stateLabelPoints,
} from './state-labels';

test('every one of the 51 states/D.C. gets exactly one label point', () => {
  const points = stateLabelPoints();
  assert.equal(points.length, US_STATES.length);
  assert.equal(points.length, 51);
  const postalCodes = new Set(points.map((point) => point.postalCode));
  assert.equal(postalCodes.size, 51, 'postal codes must be unique');
  for (const state of US_STATES) {
    assert.ok(postalCodes.has(state.postalCode), `missing label point for ${state.postalCode}`);
  }
});

test('every label point falls within its own state bbox (bbox centroid by default)', () => {
  const points = new Map(stateLabelPoints().map((point) => [point.postalCode, point] as const));
  for (const state of US_STATES) {
    // AK/HI/FL/MI use a documented override that may sit outside the coarse bbox (that's the
    // point of overriding them); every other state's point must be the literal bbox centroid.
    if (['AK', 'HI', 'FL', 'MI'].includes(state.postalCode)) continue;
    const [west, south, east, north] = state.bbox;
    const point = points.get(state.postalCode)!;
    assert.equal(point.lng, (west + east) / 2);
    assert.equal(point.lat, (south + north) / 2);
  }
});

test('the documented AK/HI/FL/MI overrides are actually applied, not the raw bbox centroid', () => {
  const points = new Map(stateLabelPoints().map((point) => [point.postalCode, point] as const));
  for (const postalCode of ['AK', 'HI', 'FL', 'MI'] as const) {
    const state = US_STATES.find((s) => s.postalCode === postalCode)!;
    const [west, south, east, north] = state.bbox;
    const rawCentroid = [(west + east) / 2, (south + north) / 2];
    const point = points.get(postalCode)!;
    assert.notEqual(point.lng, rawCentroid[0], `${postalCode} should use its documented override, not raw bbox centroid lng`);
    // Every override must still land inside (or acceptably near) the state's own bbox rather
    // than drifting to an unrelated part of the country.
    assert.ok(point.lng >= west - 2 && point.lng <= east + 2, `${postalCode} override lng ${point.lng} is nowhere near its bbox`);
    assert.ok(point.lat >= south - 2 && point.lat <= north + 2, `${postalCode} override lat ${point.lat} is nowhere near its bbox`);
  }
});

test('opacity is fully visible at/below the fade-start zoom and fully hidden at/above the fade-end zoom', () => {
  assert.equal(stateLabelOpacityForZoom(0), 1);
  assert.equal(stateLabelOpacityForZoom(STATE_LABEL_FADE_START_ZOOM), 1);
  assert.equal(stateLabelOpacityForZoom(STATE_LABEL_FADE_END_ZOOM), 0);
  assert.equal(stateLabelOpacityForZoom(12), 0);
});

test('opacity fades linearly between the start and end zoom', () => {
  const midpoint = (STATE_LABEL_FADE_START_ZOOM + STATE_LABEL_FADE_END_ZOOM) / 2;
  assert.ok(Math.abs(stateLabelOpacityForZoom(midpoint) - 0.5) < 1e-9);
  const quarter = STATE_LABEL_FADE_START_ZOOM + (STATE_LABEL_FADE_END_ZOOM - STATE_LABEL_FADE_START_ZOOM) * 0.25;
  assert.ok(Math.abs(stateLabelOpacityForZoom(quarter) - 0.75) < 1e-9);
});

test('buildStateLabelMarkers marks exactly the selected postal code, leaving text/position untouched', () => {
  const markers = buildStateLabelMarkers('NY');
  assert.equal(markers.length, 51);
  const ny = markers.find((marker) => marker.postalCode === 'NY')!;
  assert.equal(ny.selected, true);
  assert.equal(ny.text, 'NY');
  const others = markers.filter((marker) => marker.postalCode !== 'NY');
  assert.ok(others.every((marker) => marker.selected === false));

  const noSelection = buildStateLabelMarkers();
  assert.ok(noSelection.every((marker) => marker.selected === false));
});

test('buildStateLabelMarkers position/text are identical regardless of selection (selection only recolors)', () => {
  const unselected = buildStateLabelMarkers();
  const selected = buildStateLabelMarkers('CA');
  for (let i = 0; i < unselected.length; i += 1) {
    assert.equal(unselected[i]!.postalCode, selected[i]!.postalCode);
    assert.deepEqual(unselected[i]!.lngLat, selected[i]!.lngLat);
    assert.equal(unselected[i]!.text, selected[i]!.text);
  }
});
