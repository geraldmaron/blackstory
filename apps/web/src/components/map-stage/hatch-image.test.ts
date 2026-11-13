import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HATCH_TILE_PX, hatchPixels } from './hatch-image';

test('the hatch tile is a 2px sand diagonal on transparent that joins across tiles', () => {
  const px = hatchPixels();
  assert.equal(px.length, HATCH_TILE_PX * HATCH_TILE_PX * 4);
  const alpha = (x: number, y: number) => px[(y * HATCH_TILE_PX + x) * 4 + 3];
  assert.equal(alpha(0, 0), 255);
  assert.equal(alpha(1, 0), 255);
  assert.equal(alpha(4, 0), 0);
  // The line leaving the right edge re-enters on the left one row down.
  assert.equal(alpha(HATCH_TILE_PX - 1, 1), 255);
  assert.deepEqual([...px.slice(0, 3)], [0xd8, 0xa1, 0x78]);
});
