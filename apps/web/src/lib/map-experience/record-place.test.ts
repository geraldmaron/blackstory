import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import { mapHrefInPlace, recordPlaceFor, recordPlaceHref } from './record-place';

function record(
  id: string,
  precision: string,
  lng: number,
  lat: number,
  statePostalCode: string,
  jurisdictionLabel: string,
): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { entityId: id, precision, statePostalCode, jurisdictionLabel },
  } as unknown as ExploreMapFeature;
}

const collection: ExploreMapFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    record('a', 'site', -77.03, 38.9, 'DC', 'Washington, District of Columbia'),
    record('b', 'site', -77.01, 38.89, 'DC', 'Washington, District of Columbia'),
    record('c', 'city', -77.04, 38.91, 'DC', 'Washington, District of Columbia'),
    record('d', 'state', -83.4, 32.7, 'GA', 'Georgia'),
    record('e', 'state', -83.4, 32.7, 'GA', 'Georgia'),
  ],
};

describe('recordPlaceFor', () => {
  it('names a city record by its city and counts every record there, at every precision', () => {
    const place = recordPlaceFor(collection, undefined, 'a');
    assert.equal(place?.key, 'city-dc-washington');
    assert.equal(place?.count, 3);
    assert.match(place?.name ?? '', /Washington/);
  });

  it('names a statewide record by its state and never by anything finer', () => {
    const place = recordPlaceFor(collection, undefined, 'd');
    assert.equal(place?.key, 'state-ga');
    assert.equal(place?.count, 2);
  });

  it('has no place for a record the catalog does not hold', () => {
    assert.equal(recordPlaceFor(collection, undefined, 'missing'), undefined);
  });

  it('links to the place with the record selected inside it', () => {
    const href = recordPlaceHref('city-dc-washington', 'a');
    const params = new URL(href, 'https://example.test').searchParams;
    assert.equal(params.get('place'), 'city-dc-washington');
    assert.equal(params.get('selected'), 'a');
  });

  it('adds the place to a hand-off that already carries the reader narrowing', () => {
    const href = mapHrefInPlace('/explore?era=1920s&selected=a', 'state-ga');
    const params = new URL(href, 'https://example.test').searchParams;
    assert.equal(params.get('era'), '1920s');
    assert.equal(params.get('selected'), 'a');
    assert.equal(params.get('place'), 'state-ga');
  });
});
