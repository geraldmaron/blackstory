import assert from 'node:assert/strict';
import { test } from 'node:test';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import type { ExploreMapFeature } from './build-explore-map-source';
import { featuresInView, narrowingBounds, viewHoldsNation } from './view-scope';

const at = (id: string, lng: number, lat: number) =>
  ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { entityId: id },
  }) as unknown as ExploreMapFeature;

const atlanta = at('atl', -84.39, 33.75);
const denver = at('den', -104.99, 39.74);
const juneau = at('jnu', -134.42, 58.3);
const [west, south, east, north] = US_CONUS_BOUNDS;
const national = { west: west - 5, south: south - 5, east: east + 5, north: north + 5 };
const georgia = { west: -85.6, south: 30.4, east: -80.8, north: 35.0 };

test('the national view never narrows, so Alaska and Hawaii stay listed', () => {
  assert.equal(viewHoldsNation(national), true);
  assert.equal(narrowingBounds(national), null);
  assert.deepEqual(featuresInView([atlanta, denver, juneau], national), [atlanta, denver, juneau]);
});

test('a closer view lists only the records whose point is on screen', () => {
  assert.deepEqual(featuresInView([atlanta, denver, juneau], georgia), [atlanta]);
});

test('no bounds yet (the map has not reported) lists everything', () => {
  assert.deepEqual(featuresInView([atlanta, denver], null), [atlanta, denver]);
});
