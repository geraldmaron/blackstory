/**
 * Explore first-paint pin clicks resolve to catalog ids without leaking shop tokens.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature } from './build-explore-map-source';
import {
  emitExplorePinSelect,
  pointerExceededClickSlop,
  resolveExplorePinEntityId,
  subscribeExplorePinSelect,
} from './explore-pin-select';

function feature(
  entityId: string,
  lng: number,
  lat: number,
  extra: Partial<ExploreMapFeature['properties']> = {},
): ExploreMapFeature {
  return {
    type: 'Feature',
    id: entityId,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      entityId,
      href: '',
      kind: 'place',
      displayName: entityId,
      oneLineStory: '',
      precision: 'city',
      geoPrecisionTier: 'locality',
      eraBuckets: [],
      evidenceCount: 0,
      confidenceTier: 'unrated',
      topicTags: [],
      shade: '#6D675F',
      glyph: 'place',
      kindFamily: 'place',
      ...extra,
    },
  };
}

test('a still-first-paint pin id selects itself', () => {
  const pins = [feature('pin-3', -77.02, 38.91)];
  assert.equal(
    resolveExplorePinEntityId({ pinId: 'pin-3', lng: -77.02, lat: 38.91 }, pins),
    'pin-3',
  );
});

test('catalog features match the disc coordinates after pin-N ids leave the source', () => {
  const catalog = [feature('ent_howard_theatre_001', -77.02, 38.91)];
  assert.equal(
    resolveExplorePinEntityId({ pinId: 'pin-3', lng: -77.02, lat: 38.91 }, catalog),
    'ent_howard_theatre_001',
  );
});

test('coincident points prefer a holding walk', () => {
  const catalog = [
    feature('ent_neighbor', -80.14, 26.12),
    feature('ent_walk', -80.14, 26.12, { holdingWalk: true }),
  ];
  assert.equal(
    resolveExplorePinEntityId({ pinId: 'pin-0', lng: -80.14, lat: 26.12 }, catalog),
    'ent_walk',
  );
});

test('attribute round-trip still matches catalog floats', () => {
  const lng = -77.036_870_7;
  const catalog = [feature('ent_ok', lng, 38.907_192_3)];
  assert.equal(
    resolveExplorePinEntityId(
      { pinId: 'pin-1', lng: Number(String(lng)), lat: 38.907_192_3 },
      catalog,
    ),
    'ent_ok',
  );
});

test('unknown geography does not invent an id', () => {
  assert.equal(
    resolveExplorePinEntityId({ pinId: 'pin-9', lng: 0, lat: 0 }, [feature('ent_ok', -77, 38)]),
    undefined,
  );
});

test('click slop treats a tap as select and a drag as pan', () => {
  assert.equal(pointerExceededClickSlop(10, 10, 12, 11), false);
  assert.equal(pointerExceededClickSlop(10, 10, 20, 20), true);
});

test('pin-select subscribers receive the emitted target', () => {
  const seen: string[] = [];
  const stop = subscribeExplorePinSelect((target) => {
    seen.push(target.pinId);
  });
  emitExplorePinSelect({ pinId: 'pin-1', lng: 1, lat: 2 });
  stop();
  emitExplorePinSelect({ pinId: 'pin-2' });
  assert.deepEqual(seen, ['pin-1']);
});
