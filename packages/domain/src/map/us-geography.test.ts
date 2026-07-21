/**
 * Tests for the U.S. state reference table and approximate point lookup.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  US_STATES,
  US_BOUNDS,
  findUsStateForPoint,
  findUsStateFromJurisdictionLabel,
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

test('NY/NJ carve-out: Manhattan and Harlem resolve to NY, not NJ', () => {
  // NJ's rectangular bbox overlaps Manhattan; without the Hudson carve-out,
  // smallest-bbox-first would attribute Harlem / Lower Manhattan to New Jersey
  // (historically tested as a known gap — now an unacceptable user-visible bug).
  assert.equal(findUsStateForPoint(40.7128, -74.006)?.postalCode, 'NY'); // Lower Manhattan
  assert.equal(findUsStateForPoint(40.8116, -73.9465)?.postalCode, 'NY'); // Harlem
  assert.equal(findUsStateForPoint(40.758, -73.9855)?.postalCode, 'NY'); // Midtown
  assert.equal(findUsStateForPoint(40.6782, -73.9442)?.postalCode, 'NY'); // Brooklyn
});

test('NY/NJ carve-out: Hoboken and Newark stay NJ; Staten Island is NY', () => {
  assert.equal(findUsStateForPoint(40.745, -74.0325)?.postalCode, 'NJ'); // Hoboken
  assert.equal(findUsStateForPoint(40.7357, -74.1724)?.postalCode, 'NJ'); // Newark
  assert.equal(findUsStateForPoint(40.5795, -74.1502)?.postalCode, 'NY'); // Staten Island
});

test('findUsStateFromJurisdictionLabel prefers editorial label tails', () => {
  assert.equal(
    findUsStateFromJurisdictionLabel('New York City, New York')?.postalCode,
    'NY',
  );
  assert.equal(
    findUsStateFromJurisdictionLabel('Harlem, New York City, New York')?.postalCode,
    'NY',
  );
  assert.equal(findUsStateFromJurisdictionLabel('Hoboken, New Jersey')?.postalCode, 'NJ');
  assert.equal(findUsStateFromJurisdictionLabel('Washington, D.C.')?.postalCode, 'DC');
  assert.equal(findUsStateFromJurisdictionLabel('Annapolis, MD')?.postalCode, 'MD');
  assert.equal(findUsStateFromJurisdictionLabel(''), undefined);
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
