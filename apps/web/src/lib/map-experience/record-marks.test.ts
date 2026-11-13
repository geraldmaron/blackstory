import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import { drawnRecordCollection, jurisdictionTagCollection } from './record-marks';

function feature(entityId: string, precision: string, statePostalCode = 'MD'): ExploreMapFeature {
  return {
    type: 'Feature',
    id: entityId,
    geometry: { type: 'Point', coordinates: [-76.8, 39.27] },
    properties: { entityId, precision, statePostalCode } as ExploreMapFeature['properties'],
  };
}

const collection: ExploreMapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    feature('site', 'site'),
    feature('city', 'city'),
    feature('state-1', 'state'),
    feature('state-2', 'state'),
    feature('county', 'county'),
    feature('va-county', 'county', 'VA'),
  ],
};

test('only dot and ring records reach the map as points', () => {
  const drawn = drawnRecordCollection(collection);
  assert.deepEqual(
    drawn.features.map((row) => row.properties.entityId),
    ['site', 'city'],
  );
  assert.equal(drawnRecordCollection(collection), drawn, 'memoized per collection');
});

test('county and state records are counted in one tag per state, at its label point', () => {
  const tags = jurisdictionTagCollection(collection).features;
  const md = tags.find((tag) => tag.properties.postalCode === 'MD');
  const va = tags.find((tag) => tag.properties.postalCode === 'VA');
  assert.equal(md?.properties.label, '2 statewide · 1 by county');
  assert.equal(md?.properties.ids, '|state-1|state-2|county|');
  assert.equal(va?.properties.label, '1 by county');
  assert.equal(tags.length, 2);
});
