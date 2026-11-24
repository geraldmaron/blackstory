import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { NEAR_METERS, nearestRecords } from './town-field';

const pin = (id: string, lng: number, lat: number, href = `/place/${id}`): ExploreMapFeature =>
  ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { entityId: id, displayName: `Record ${id}`, href },
  }) as unknown as ExploreMapFeature;

describe('the nearest records to a town', () => {
  const town = { lat: 38.9, lng: -77.0 };

  it('lists the nearest first, and only those within fifty miles', () => {
    const { near, nearest } = nearestRecords(
      [pin('far', -90, 38.9), pin('b', -77.3, 38.9), pin('a', -77.01, 38.9)],
      town,
    );
    assert.deepEqual(
      near.map((record) => record.id),
      ['a', 'b'],
    );
    assert.equal(nearest?.id, 'a');
    assert.ok(near.every((record) => record.meters <= NEAR_METERS));
  });

  it('says nothing is near when the nearest record is past fifty miles, and still names it', () => {
    const { near, nearest } = nearestRecords([pin('far', -90, 38.9)], town);
    assert.deepEqual(near, []);
    assert.equal(nearest?.id, 'far');
  });

  it('answers an empty archive', () => {
    assert.deepEqual(nearestRecords([], town), { near: [], nearest: null });
  });

  it('keeps to three, and skips a record with nowhere to link', () => {
    const many = [1, 2, 3, 4, 5].map((n) => pin(`r${n}`, -77 - n / 100, 38.9));
    assert.equal(nearestRecords([pin('nolink', -77, 38.9, ''), ...many], town).near.length, 3);
    assert.ok(
      nearestRecords([pin('nolink', -77, 38.9, '')], town).near.every((r) => r.id !== 'nolink'),
    );
  });
});
