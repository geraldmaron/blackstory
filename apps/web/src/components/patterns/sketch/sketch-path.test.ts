import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sketchHatchLines, sketchHousePath, sketchRect } from './sketch-path';

test('sketch primitives quantize every emitted coordinate for hydration stability', () => {
  const path = `${sketchRect(12, 150, 616, 8, 1870, 1.2)} ${sketchHousePath(40, 40, 90, 90, 1881)}`;
  const numericTokens = path.match(/-?\d+(?:\.\d+)?/g) ?? [];

  assert.ok(numericTokens.length > 0);
  for (const token of numericTokens) {
    const decimals = token.split('.')[1];
    assert.ok(!decimals || decimals.length <= 3, `unquantized path coordinate: ${token}`);
  }

  for (const line of sketchHatchLines(40, 40, 90, 90, 0.38, 1901)) {
    for (const coordinate of Object.values(line)) {
      assert.equal(coordinate, Math.round(coordinate * 1_000) / 1_000);
    }
  }
});
