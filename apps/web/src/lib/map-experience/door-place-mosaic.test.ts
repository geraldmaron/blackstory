/**
 * Door place mosaic tile selection: deterministic per release id, spread across states,
 * capped at 24, floored at whatever is available up to 12, and never a record without a
 * `/place/` href (never `/law` or the `/door/pin/*` catalog proxy either).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature, ExploreMapFeatureCollection } from './build-explore-map-source';
import {
  DOOR_MOSAIC_MAX_TILES,
  DOOR_MOSAIC_MIN_TILES,
  selectDoorMosaicTiles,
} from './door-place-mosaic';

const STATES = ['CA', 'NY', 'TX', 'FL', 'OH', 'GA'] as const;

function feature(
  index: number,
  overrides: Partial<ExploreMapFeature['properties']> = {},
): ExploreMapFeature {
  const state = STATES[index % STATES.length]!;
  return {
    type: 'Feature',
    id: `pin-${index}`,
    geometry: { type: 'Point', coordinates: [-90 + index, 30 + index] },
    properties: {
      entityId: `ent_place_${index}`,
      href: `/place/place-${index}`,
      kind: 'place',
      displayName: `Place ${index}`,
      oneLineStory: '',
      precision: 'exact',
      geoPrecisionTier: 'exact',
      eraBuckets: [`${Math.floor((1900 + index) / 10) * 10}s`],
      evidenceCount: 1,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#000000',
      glyph: 'circle',
      kindFamily: 'places',
      statePostalCode: state,
      ...overrides,
    },
  };
}

function pinPlate(features: readonly ExploreMapFeature[]): ExploreMapFeatureCollection {
  return { type: 'FeatureCollection', features };
}

function manyPlaceFeatures(count: number): ExploreMapFeature[] {
  return Array.from({ length: count }, (_, i) => feature(i));
}

test('caps tile count at 24 and never exceeds the candidate pool', () => {
  const features = manyPlaceFeatures(60);
  const tiles = selectDoorMosaicTiles({
    pins: pinPlate(features),
    features,
    releaseId: 'release-abc',
  });
  assert.ok(tiles.length <= DOOR_MOSAIC_MAX_TILES);
  assert.equal(tiles.length, DOOR_MOSAIC_MAX_TILES);
});

test('uses every candidate when the pool is smaller than the floor', () => {
  const features = manyPlaceFeatures(5);
  const tiles = selectDoorMosaicTiles({
    pins: pinPlate(features),
    features,
    releaseId: 'release-abc',
  });
  assert.equal(tiles.length, 5);
  assert.ok(tiles.length < DOOR_MOSAIC_MIN_TILES);
});

test('is deterministic for a given release id', () => {
  const features = manyPlaceFeatures(40);
  const first = selectDoorMosaicTiles({ pins: pinPlate(features), features, releaseId: 'r-1' });
  const second = selectDoorMosaicTiles({ pins: pinPlate(features), features, releaseId: 'r-1' });
  assert.deepEqual(
    first.map((tile) => tile.key),
    second.map((tile) => tile.key),
  );
});

test('a different release id may select a different tile set', () => {
  const features = manyPlaceFeatures(60);
  const a = selectDoorMosaicTiles({ pins: pinPlate(features), features, releaseId: 'r-1' });
  const b = selectDoorMosaicTiles({ pins: pinPlate(features), features, releaseId: 'r-2' });
  assert.notDeepEqual(
    a.map((tile) => tile.key),
    b.map((tile) => tile.key),
  );
});

test('spreads selection across states rather than clustering in one', () => {
  const features = manyPlaceFeatures(60);
  const tiles = selectDoorMosaicTiles({ pins: pinPlate(features), features, releaseId: 'r-1' });
  const states = new Set(tiles.map((tile) => tile.stateLabel));
  assert.ok(states.size >= STATES.length, `expected every state represented, got ${states.size}`);
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    const key = tile.stateLabel ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const max = Math.max(...counts.values());
  assert.ok(max <= Math.ceil(tiles.length / STATES.length) + 1, 'one state dominated the mosaic');
});

test('never selects a record without a `/place/` href', () => {
  const placeFeatures = manyPlaceFeatures(10);
  const entityOnly = feature(100, { href: '/door/pin/pin-100', statePostalCode: 'WA' });
  const lawRecord = feature(101, { href: '/law', statePostalCode: 'WA' });
  const noHref = feature(102, { href: '', statePostalCode: 'WA' });
  const features = [...placeFeatures, entityOnly, lawRecord, noHref];
  const tiles = selectDoorMosaicTiles({ pins: pinPlate(features), features, releaseId: 'r-1' });
  assert.ok(tiles.every((tile) => tile.href.startsWith('/place/')));
  assert.equal(tiles.length, placeFeatures.length);
});

test('empty pin plate yields no tiles', () => {
  const tiles = selectDoorMosaicTiles({ pins: pinPlate([]), features: [], releaseId: 'r-1' });
  assert.deepEqual(tiles, []);
});
