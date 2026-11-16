import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAP_TYPE } from '../../app/map/explore-style';
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

test('MAP_TYPE mirrors the map type and mark tokens in tokens.css', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../../../../../packages/ui/src/styles/tokens.css', import.meta.url)),
    'utf8',
  );
  const px = (name: string): number => {
    const value = new RegExp(`${name}:\\s*([\\d.]+)(rem|px)`).exec(css);
    assert.ok(value, `${name} is defined`);
    return value[2] === 'rem' ? Number(value[1]) * 16 : Number(value[1]);
  };
  assert.deepEqual(
    [1, 2, 3].map((n) => px(`--ds-map-count-${n}`)),
    [...MAP_TYPE.count],
  );
  assert.deepEqual(
    [1, 2, 3].map((n) => px(`--ds-map-name-${n}`)),
    [...MAP_TYPE.name],
  );
  assert.equal(px('--ds-map-name-2'), MAP_TYPE.site);
  assert.equal(px('--ds-map-pin'), MAP_TYPE.pin);
  assert.equal(px('--ds-map-ring'), MAP_TYPE.ring);
  assert.equal(px('--ds-map-keyline'), MAP_TYPE.keyline);
});
