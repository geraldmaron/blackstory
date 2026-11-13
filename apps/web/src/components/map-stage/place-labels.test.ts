import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeMapName, placeTier } from '../../lib/map-experience/place-map';
import { placeLabelText } from './place-labels';

test('the plate names a place atlas style: no state suffix, no "County"', () => {
  assert.equal(placeMapName('county', 'Jefferson County, AL'), 'Jefferson');
  assert.equal(placeMapName('county', 'Orleans Parish, LA'), 'Orleans Parish');
  assert.equal(placeMapName('city', 'Washington, DC'), 'Washington');
  assert.equal(placeMapName('state', 'Alabama'), 'Alabama');
});

test('a state token prints its postal code at national scale and its name past it', () => {
  const state = { level: 'state', mapName: 'Alabama', postal: 'AL' };
  assert.equal(placeLabelText(state, 3.5), 'AL');
  assert.equal(placeLabelText(state, 5), 'Alabama');
  assert.equal(
    placeLabelText({ level: 'county', mapName: 'Jefferson', postal: '' }, 3),
    'Jefferson',
  );
});

test('type steps follow the three count steps', () => {
  assert.deepEqual([placeTier(1), placeTier(10), placeTier(99), placeTier(100)], [0, 1, 1, 2]);
});
