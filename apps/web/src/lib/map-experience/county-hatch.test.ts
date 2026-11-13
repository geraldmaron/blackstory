import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hatchedCountyKeys } from './county-hatch';
import type { ExploreMapFeatureCollection } from './build-explore-map-source';

const square = (x: number, y: number) => [
  [
    [x, y],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
    [x, y],
  ],
];
const counties = {
  features: [
    {
      properties: { stateFips: '01', countyFips: '001' },
      geometry: { type: 'Polygon', coordinates: square(0, 0) },
    },
    {
      properties: { stateFips: '01', countyFips: '003' },
      geometry: { type: 'Polygon', coordinates: square(1, 0) },
    },
    {
      properties: { stateFips: '13', countyFips: '117' },
      geometry: { type: 'MultiPolygon', coordinates: [square(5, 5)] },
    },
  ],
};
const record = (precision: string, lng: number, lat: number) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { entityId: `${precision}-${lng}`, precision, statePostalCode: 'AL' },
});
const records = (...features: unknown[]) =>
  ({ type: 'FeatureCollection', features }) as unknown as ExploreMapFeatureCollection;

test('a county record hatches only the county its point falls in, never its neighbors', () => {
  assert.deepEqual(hatchedCountyKeys(records(record('county', 0.5, 0.5)), counties), ['01001']);
  assert.deepEqual(hatchedCountyKeys(records(record('county', 5.5, 5.5)), counties), ['13117']);
});

test('state, city and site records hatch no county, and nothing hatches before geometry loads', () => {
  const all = records(
    record('state', 0.5, 0.5),
    record('city', 1.5, 0.5),
    record('site', 1.5, 0.5),
  );
  assert.deepEqual(hatchedCountyKeys(all, counties), []);
  assert.deepEqual(hatchedCountyKeys(records(record('county', 0.5, 0.5)), undefined), []);
  assert.deepEqual(hatchedCountyKeys(records(record('county', 9, 9)), counties), []);
});
