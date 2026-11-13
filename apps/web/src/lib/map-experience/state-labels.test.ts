/**
 * Confirms the state-label data: all 51 states + D.C. get a label point, the documented
 * AK/HI/FL/MI/MD overrides are actually applied (not silently ignored), and the zoom band matches
 * design-direction-v3.md (visible from the national floor, gone by 6.2). How the labels draw is
 * covered in `app/map/explore-style.test.ts`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { US_STATES } from '@repo/domain/map/geography';
import {
  STATE_LABEL_APPEAR_END_ZOOM,
  STATE_LABEL_APPEAR_START_ZOOM,
  STATE_LABEL_FADE_END_ZOOM,
  STATE_LABEL_FADE_START_ZOOM,
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
    // AK/HI/FL/MI/MD use a documented override that may sit outside the coarse bbox (that's the
    // point of overriding them); every other state's point must be the literal bbox centroid.
    if (['AK', 'HI', 'FL', 'MI', 'MD'].includes(state.postalCode)) continue;
    const [west, south, east, north] = state.bbox;
    const point = points.get(state.postalCode)!;
    assert.equal(point.lng, (west + east) / 2);
    assert.equal(point.lat, (south + north) / 2);
  }
});

test('the documented AK/HI/FL/MI/MD overrides are actually applied, not the raw bbox centroid', () => {
  const points = new Map(stateLabelPoints().map((point) => [point.postalCode, point] as const));
  for (const postalCode of ['AK', 'HI', 'FL', 'MI', 'MD'] as const) {
    const state = US_STATES.find((s) => s.postalCode === postalCode)!;
    const [west, south, east, north] = state.bbox;
    const rawCentroid = [(west + east) / 2, (south + north) / 2];
    const point = points.get(postalCode)!;
    assert.notEqual(
      point.lng,
      rawCentroid[0],
      `${postalCode} should use its documented override, not raw bbox centroid lng`,
    );
    // Every override must still land inside (or acceptably near) the state's own bbox rather
    // than drifting to an unrelated part of the country.
    assert.ok(
      point.lng >= west - 2 && point.lng <= east + 2,
      `${postalCode} override lng ${point.lng} is nowhere near its bbox`,
    );
    assert.ok(
      point.lat >= south - 2 && point.lat <= north + 2,
      `${postalCode} override lat ${point.lat} is nowhere near its bbox`,
    );
  }
});

test('the band opens at the national floor and closes before city names take over', () => {
  assert.ok(STATE_LABEL_APPEAR_START_ZOOM < STATE_LABEL_APPEAR_END_ZOOM);
  assert.equal(STATE_LABEL_APPEAR_END_ZOOM, 3);
  assert.ok(STATE_LABEL_APPEAR_END_ZOOM < STATE_LABEL_FADE_START_ZOOM);
  assert.equal(STATE_LABEL_FADE_START_ZOOM, 5.6);
  assert.equal(STATE_LABEL_FADE_END_ZOOM, 6.2);
});
