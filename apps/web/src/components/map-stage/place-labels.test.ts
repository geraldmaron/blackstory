import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAP_TYPE } from '../../app/map/explore-style';
import { placeMapName, placeTier } from '../../lib/map-experience/place-map';
import { placeFullName, placeLabelText, placeTypeScale } from './place-labels';

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
  assert.equal(px('--ds-map-site'), MAP_TYPE.site);
  assert.equal(px('--ds-map-pin'), MAP_TYPE.pin);
  assert.equal(px('--ds-map-ring'), MAP_TYPE.ring);
  assert.equal(px('--ds-map-keyline'), MAP_TYPE.keyline);
});

test('a state is written out by name where a code would not read', () => {
  assert.equal(placeFullName({ level: 'state', mapName: 'VA', postal: 'VA' }), 'Virginia');
  assert.equal(placeFullName({ level: 'county', mapName: 'Fulton' }), 'Fulton');
  assert.equal(
    placeLabelText({ level: 'state', mapName: 'GA', postal: 'GA' }, 3, { selected: false }),
    'Georgia',
  );
  assert.equal(
    placeLabelText({ level: 'state', mapName: 'GA', postal: 'GA' }, 3, { selected: true }),
    'GA',
  );
});

test('place type stays small on a phone and grows only a little toward the street', () => {
  assert.equal(placeTypeScale(390, 3.5), 0.85);
  assert.equal(placeTypeScale(1024, 4), 0.85);
  assert.equal(placeTypeScale(1440, 4), 1.1);
  assert.ok(placeTypeScale(1440, 14) <= 1.1 * 1.2);
  assert.ok(MAP_TYPE.count[2] * placeTypeScale(1440, 14) < 22);
});
