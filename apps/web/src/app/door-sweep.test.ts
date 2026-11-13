/**
 * The sweep opens on the first decade the plate actually has records in, not on a lone outlier.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ExploreMapFeature,
  ExploreMapFeatureCollection,
} from '../lib/map-experience/build-explore-map-source';
import { sweepRange } from './door-sweep';

function pins(decades: readonly number[]): ExploreMapFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: decades.map(
      (decade, index) =>
        ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-90, 35] },
          properties: { entityId: `r${index}`, eraBuckets: [`${decade}s`] },
        }) as unknown as ExploreMapFeature,
    ),
  } as ExploreMapFeatureCollection;
}

test('a single 1510s record does not open the sweep four centuries early', () => {
  assert.deepEqual(sweepRange(pins([1510, 1700, 1700, 1700, 1960, 1960])), {
    from: 1700,
    to: 1960,
  });
});

test('a plate with no decade that reaches the floor opens on its earliest decade', () => {
  assert.deepEqual(sweepRange(pins([1860, 1900])), { from: 1860, to: 1900 });
  assert.equal(sweepRange(pins([])), null);
});
