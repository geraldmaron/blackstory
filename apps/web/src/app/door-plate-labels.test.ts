/**
 * One tag line per state for the records the map draws no point for.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
} from '../lib/map-experience/build-explore-map-source';
import { doorStateTagLines } from './door-plate-labels';

function pins(
  rows: readonly (readonly [precision: string, state: string | undefined])[],
): ExploreMapFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(
      ([precision, statePostalCode], index) =>
        ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-90, 35] },
          properties: { entityId: `r${index}`, precision, statePostalCode },
        }) as unknown as ExploreMapFeature,
    ),
  } as ExploreMapFeatureCollection;
}

test('county and state records merge into one line per state; drawn records are not counted', () => {
  const lines = doorStateTagLines(
    pins([
      ['county', 'WA'],
      ['county', 'WA'],
      ['state', 'NY'],
      ['county', 'TX'],
      ['state', 'TX'],
      ['exact', 'TX'],
      ['city', 'GA'],
      ['county', undefined],
    ]),
  );
  assert.equal(lines.get('WA'), '2 by county');
  assert.equal(lines.get('NY'), '1 statewide');
  assert.equal(lines.get('TX'), '2 by county or state');
  assert.equal(lines.has('GA'), false);
  assert.equal(lines.size, 3);
});
