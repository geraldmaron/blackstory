import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlaceGroups } from '@repo/domain/map/place-groups';
import { placeDrillZoom, placeOpenZooms } from './place-map';

const token = (placeKey: string, level: string, minZoom: number, memberIds: string[]) =>
  ({ placeKey, level, minZoom, memberIds }) as never;

// A county keeps its own token through every band (it holds the records known only by county),
// so it opens where its records first draw finer: a square at 11, a lone site at 11, else 14.
const groups = {
  tokens: [
    token('county-a', 'county', 6, ['a1', 'a2', 'a3']),
    token('county-a', 'county', 8, ['a3']),
    token('square-1', 'square', 11, ['a1', 'a2']),
    token('county-b', 'county', 6, ['b1']),
    token('state-x', 'state', 0, ['a1', 'a2', 'a3']),
  ],
  pathById: new Map([
    ['a1', { band: 'site', square: 'square-1' }],
    ['a2', { band: 'site', square: 'square-1' }],
    ['a3', { band: 'county' }],
    ['b1', { band: 'county' }],
  ]),
} as unknown as PlaceGroups;

test('a place opens where its records first draw finer than the place', () => {
  const open = placeOpenZooms(groups);
  assert.equal(open.get('county-a'), 11);
  assert.equal(open.get('square-1'), 14);
});

test('a state has no entry, so it opens at the county level', () => {
  assert.equal(placeOpenZooms(groups).has('state-x'), false);
});

test('a place holding only county-precision records has no finer zoom', () => {
  assert.equal(placeOpenZooms(groups).has('county-b'), false);
});

test('a drill never lands shallower than the open zoom, nor deeper than the map allows', () => {
  assert.equal(placeDrillZoom('county', 9, 14, 11), 11);
  assert.equal(placeDrillZoom('county', 12, 14, 11), 12);
  assert.equal(placeDrillZoom('county', 9, 10, 11), 10);
  assert.equal(placeDrillZoom('county', undefined, 14), 8);
});
