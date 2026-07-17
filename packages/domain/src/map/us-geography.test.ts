/**
 * Tests for the U.S. state reference table and approximate point lookup.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  US_STATES,
  US_BOUNDS,
  findUsStateForPoint,
  findUsStateByPostalCode,
  isWithinUsBounds,
} from './us-geography.js';

test('table has exactly 50 states plus D.C.', () => {
  assert.equal(US_STATES.length, 51);
  const postalCodes = new Set(US_STATES.map((s) => s.postalCode));
  assert.equal(postalCodes.size, 51);
  assert.ok(postalCodes.has('DC'));
});

test('every state has a unique 2-digit FIPS code', () => {
  const fipsCodes = new Set(US_STATES.map((s) => s.fips));
  assert.equal(fipsCodes.size, 51);
  for (const state of US_STATES) {
    assert.match(state.fips, /^\d{2}$/);
  }
});

test('findUsStateForPoint resolves well-known coordinates', () => {
  assert.equal(findUsStateForPoint(38.9072, -77.0369)?.postalCode, 'DC');
  assert.equal(findUsStateForPoint(42.6526, -73.7562)?.postalCode, 'NY'); // Albany, NY
  assert.equal(findUsStateForPoint(34.0522, -118.2437)?.postalCode, 'CA'); // Los Angeles
  assert.equal(findUsStateForPoint(41.8781, -87.6298)?.postalCode, 'IL'); // Chicago
});

test('smaller states resolve ahead of larger overlapping neighbors', () => {
  // D.C. sits inside the MD/VA bounding-box overlap; must not resolve to either.
  const dc = findUsStateForPoint(38.9, -77.03);
  assert.equal(dc?.postalCode, 'DC');
});

test('documented limitation: bbox approximation can misattribute dense coastal-metro borders', () => {
  // Lower Manhattan's coordinates also fall inside New Jersey's rectangular
  // bounding box (NJ's box extends across the Hudson to cover NYC's lng/lat),
  // and NJ's smaller bbox area wins the smallest-first tie-break. This is a
  // known, intentionally-tested gap (see ADR-013 "known gaps") real
  // administrative attribution needs polygon boundary data this module does
  // not vendor. Fixtures and demo data pick unambiguous points instead.
  const result = findUsStateForPoint(40.7128, -74.006);
  assert.equal(result?.postalCode, 'NJ');
});

test('findUsStateForPoint returns undefined outside any state bbox', () => {
  // Mid-Atlantic ocean point, well outside all state bounding boxes.
  assert.equal(findUsStateForPoint(35, -50), undefined);
});

test('findUsStateByPostalCode is case-insensitive', () => {
  assert.equal(findUsStateByPostalCode('ca')?.name, 'California');
  assert.equal(findUsStateByPostalCode('TX')?.name, 'Texas');
  assert.equal(findUsStateByPostalCode('zz'), undefined);
});

test('isWithinUsBounds accepts CONUS/AK/HI points and rejects far-outside points', () => {
  assert.equal(isWithinUsBounds(38.9072, -77.0369), true);
  assert.equal(isWithinUsBounds(21.3069, -157.8583), true); // Honolulu
  assert.equal(isWithinUsBounds(64.2008, -149.4937), true); // Alaska interior
  assert.equal(isWithinUsBounds(48.8566, 2.3522), false); // Paris
});

test('US_BOUNDS is derived from the state table and is internally consistent', () => {
  const [west, south, east, north] = US_BOUNDS;
  assert.ok(west < east);
  assert.ok(south < north);
  for (const state of US_STATES) {
    const [sw, ss, se, sn] = state.bbox;
    assert.ok(sw >= west && se <= east, `${state.postalCode} west/east within US_BOUNDS`);
    assert.ok(ss >= south && sn <= north, `${state.postalCode} south/north within US_BOUNDS`);
  }
});
