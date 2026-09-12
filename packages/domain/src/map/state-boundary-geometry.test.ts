/**
 * Tests for the real-polygon containment check `findUsStateForPoint` uses to disambiguate
 * bbox ties (see `./us-geography.ts` and `./state-boundary-geometry.ts`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPointInStatePolygon } from './state-boundary-geometry.js';

test('isPointInStatePolygon resolves the two named bbox-tie failure points correctly', () => {
  // Philadelphia, PA: inside PA's real polygon, outside NJ's, despite NJ's bbox rectangle
  // reaching across the Delaware River to cover it.
  assert.equal(isPointInStatePolygon(39.95, -75.16, 'PA'), true);
  assert.equal(isPointInStatePolygon(39.95, -75.16, 'NJ'), false);

  // A Mississippi River bend point on the Louisiana side near Milliken's Bend: inside LA's
  // real polygon, outside MS's, despite MS's bbox rectangle reaching across the river.
  assert.equal(isPointInStatePolygon(32.48, -91.14, 'LA'), true);
  assert.equal(isPointInStatePolygon(32.48, -91.14, 'MS'), false);
});

test('isPointInStatePolygon resolves clear interior points', () => {
  assert.equal(isPointInStatePolygon(38.5816, -121.4944, 'CA'), true); // Sacramento, CA
  assert.equal(isPointInStatePolygon(39.7392, -104.9903, 'CO'), true); // Denver, CO
});

test('isPointInStatePolygon rejects a point clearly outside the named state', () => {
  assert.equal(isPointInStatePolygon(38.5816, -121.4944, 'NV'), false); // Sacramento is not in Nevada
  assert.equal(isPointInStatePolygon(39.7392, -104.9903, 'KS'), false); // Denver is not in Kansas
});

test('isPointInStatePolygon returns false, not throw, for an unknown postal code', () => {
  assert.equal(isPointInStatePolygon(38.5816, -121.4944, 'ZZ'), false);
});

test('isPointInStatePolygon handles a MultiPolygon state (island/detached parts)', () => {
  // Honolulu, HI sits on Oahu, one of several disjoint parts of HI's MultiPolygon geometry.
  assert.equal(isPointInStatePolygon(21.3069, -157.8583, 'HI'), true);
});
