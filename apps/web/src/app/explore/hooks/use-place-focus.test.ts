/**
 * The selected place's outline: a state or county is its own polygon, a grid square its square,
 * a city its records' extent with a small margin; the veil is the world with those rings cut out.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SQUARE_STEP_DEG } from '@repo/domain/map/place-groups';
import { outlineBounds, placeFocusCollection, placeOutline } from './use-place-focus';

const box = (w: number, s: number, e: number, n: number): [number, number][] => [
  [w, s],
  [e, s],
  [e, n],
  [w, n],
  [w, s],
];

test('a square outlines exactly its grid square', () => {
  const [west, south, east, north] = outlineBounds(
    placeOutline('square-5148-6445', undefined, undefined, undefined),
  )!;
  assert.ok(Math.abs(east - west - SQUARE_STEP_DEG) < 1e-9);
  assert.ok(Math.abs(north - south - SQUARE_STEP_DEG) < 1e-9);
  assert.ok(Math.abs(west - (5148 * SQUARE_STEP_DEG - 180)) < 1e-9);
});

test('a state and a county outline their own polygons, and nothing before they load', () => {
  const states = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature',
        properties: { postalCode: 'AL' },
        geometry: { type: 'Polygon', coordinates: [box(-88, 30, -85, 35)] },
      },
    ],
  };
  const counties = {
    features: [
      {
        properties: { stateFips: '01', countyFips: '073' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[box(-87.2, 33.2, -86.6, 33.7)], [box(-87.3, 33.1, -87.25, 33.15)]],
        },
      },
    ],
  };
  assert.deepEqual(
    outlineBounds(placeOutline('state-al', undefined, states, undefined)),
    [-88, 30, -85, 35],
  );
  assert.equal(placeOutline('county-01073', undefined, undefined, counties).length, 2);
  assert.deepEqual(placeOutline('state-al', undefined, undefined, undefined), []);
});

test('a city outlines its records, a little off the outermost ones', () => {
  const [west, south, east, north] = outlineBounds(
    placeOutline('city-dc-washington', [-77.1, 38.8, -76.9, 39], undefined, undefined),
  )!;
  assert.ok(west < -77.1 && east > -76.9 && south < 38.8 && north > 39);
});

test('the veil is the world with every ring of the place cut out', () => {
  const rings = placeOutline('square-1-1', undefined, undefined, undefined);
  const veil = placeFocusCollection(rings).features[0]!;
  assert.equal(veil.geometry.type, 'Polygon');
  assert.equal(veil.geometry.coordinates.length, 2);
  assert.deepEqual(placeFocusCollection([]).features, []);
});
