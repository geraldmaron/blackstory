/**
 * Unit tests for living mosaic tile swap selection.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ATMOSPHERE_TILE_CREDITS } from './tile-credits';
import {
  applyLivingTileSwap,
  pickLivingTileSwap,
} from './select-living-swap';
import { selectMosaicTiles } from './select-atmosphere-plane';

test('pickLivingTileSwap returns a fresh tile for a visible slot', () => {
  const visible = selectMosaicTiles('about', 16);
  const swap = pickLivingTileSwap(visible, ATMOSPHERE_TILE_CREDITS, 'about', 1);
  assert.ok(swap);
  assert.ok(swap.slot >= 0 && swap.slot < visible.length);
  assert.ok(!visible.some((tile) => tile.path === swap.tile.path));
});

test('pickLivingTileSwap is stable for the same tick and seed', () => {
  const visible = selectMosaicTiles('about', 16);
  const a = pickLivingTileSwap(visible, ATMOSPHERE_TILE_CREDITS, 'about', 7);
  const b = pickLivingTileSwap(visible, ATMOSPHERE_TILE_CREDITS, 'about', 7);
  assert.deepEqual(a, b);
});

test('pickLivingTileSwap returns null when pool cannot refresh', () => {
  const visible = ATMOSPHERE_TILE_CREDITS.slice(0, 8);
  const swap = pickLivingTileSwap(visible, visible, 'about', 1);
  assert.equal(swap, null);
});

test('applyLivingTileSwap replaces only the target slot', () => {
  const visible = selectMosaicTiles('about', 16);
  const swap = pickLivingTileSwap(visible, ATMOSPHERE_TILE_CREDITS, 'about', 3);
  assert.ok(swap);
  const next = applyLivingTileSwap(visible, swap);
  assert.equal(next.length, visible.length);
  assert.equal(next[swap.slot]?.path, swap.tile.path);
  for (let i = 0; i < visible.length; i += 1) {
    if (i === swap.slot) continue;
    assert.equal(next[i]?.path, visible[i]?.path);
  }
});

test('atmosphere tile pool is broader than the original 24-tile set', () => {
  assert.ok(ATMOSPHERE_TILE_CREDITS.length >= 40);
});
