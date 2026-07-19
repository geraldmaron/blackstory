/**
 * Unit tests for mosaic + geometric atmosphere plane selection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectAtmospherePlane, selectMosaicTiles } from './select-atmosphere-plane';

test('selectAtmospherePlane is stable for the same seed key', () => {
  const a = selectAtmospherePlane({ seedKey: 'basement-to-m-street' });
  const b = selectAtmospherePlane({ seedKey: 'basement-to-m-street' });
  assert.equal(a.planeId, b.planeId);
  assert.equal(a.mode, 'mosaic');
  assert.equal(a.tiles.length, 16);
  assert.deepEqual(
    a.tiles.map((tile) => tile.index),
    b.tiles.map((tile) => tile.index),
  );
  assert.equal(a.geometric.id, b.geometric.id);
});

test('selectAtmospherePlane defaults to mosaic mode with density 16', () => {
  const selection = selectAtmospherePlane({ seedKey: 'naming-dunbar-1916' });
  assert.equal(selection.mode, 'mosaic');
  assert.equal(selection.tiles.length, 16);
  assert.equal(selection.attributionHref, '/stories/mosaic-credits');
  assert.ok(selection.geometric.path.startsWith('/brand/atmosphere/fallback/'));
});

test('preferGeometric returns geometric mode with empty tiles', () => {
  const selection = selectAtmospherePlane({
    seedKey: 'same-footprint-new-walls',
    preferGeometric: true,
  });
  assert.equal(selection.mode, 'geometric');
  assert.equal(selection.tiles.length, 0);
});

test('selectMosaicTiles prefers related entity tiles in pool order', () => {
  const tiles = selectMosaicTiles('related-preference', 16, [
    'ent_katherine_johnson_001',
    'ent_mae_jemison_001',
  ]);
  assert.equal(tiles.length, 16);
  assert.equal(tiles[0]?.entityId, 'ent_katherine_johnson_001');
  assert.equal(tiles[1]?.entityId, 'ent_mae_jemison_001');
  assert.equal(new Set(tiles.map((tile) => tile.index)).size, tiles.length);
});

test('selectMosaicTiles fills from seed rotation when related entities miss the pool', () => {
  const tiles = selectMosaicTiles('fill-test', 16, ['ent_dunbar_school_001']);
  assert.equal(tiles.length, 16);
  assert.ok(tiles.every((tile) => tile.entityId !== 'ent_dunbar_school_001'));
  assert.equal(new Set(tiles.map((tile) => tile.index)).size, tiles.length);
});

test('different seed keys rotate mosaic tile order', () => {
  const a = selectMosaicTiles('slug-a', 16);
  const b = selectMosaicTiles('slug-b', 16);
  assert.notEqual(a.map((tile) => tile.index).join(','), b.map((tile) => tile.index).join(','));
});

test('planeId is a stable hex hash prefix', () => {
  const selection = selectAtmospherePlane({ seedKey: 'alumni-keep-the-thread' });
  assert.match(selection.planeId, /^atm-[0-9a-f]+$/);
});
