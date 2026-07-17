/**
 * Protects the "scattered pigments, not a gradient ramp" design intent:
 * every glyph cell gets a valid tone, and no two blocks that are adjacent
 * in reading order — or stacked in the same column — repeat a tone.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pigmentScale } from '../tokens/pigment.js';
import { glyphBCells } from './glyph.js';
import { PIGMENT_SCATTER_MAP } from './scatter-map.js';

test('scatter map assigns exactly one tone per filled cell', () => {
  assert.equal(PIGMENT_SCATTER_MAP.length, glyphBCells().length);
});

test('scatter map values are valid pigment indexes', () => {
  for (const toneIndex of PIGMENT_SCATTER_MAP) {
    assert.ok(toneIndex >= 0 && toneIndex < pigmentScale.length, `index ${toneIndex} out of range`);
  }
});

test('scatter map has no reading-order-adjacent repeats', () => {
  for (let i = 1; i < PIGMENT_SCATTER_MAP.length; i += 1) {
    assert.notEqual(
      PIGMENT_SCATTER_MAP[i],
      PIGMENT_SCATTER_MAP[i - 1],
      `cells ${i - 1} and ${i} repeat tone ${PIGMENT_SCATTER_MAP[i]} — reads as a ramp, not a scatter`,
    );
  }
});

test('scatter map has no same-column repeats down the left stem', () => {
  const cells = glyphBCells();
  const byColumn = new Map<number, number[]>();
  cells.forEach((cell, index) => {
    const tones = byColumn.get(cell.col) ?? [];
    tones.push(PIGMENT_SCATTER_MAP[index]);
    byColumn.set(cell.col, tones);
  });
  for (const [col, tones] of byColumn) {
    for (let i = 1; i < tones.length; i += 1) {
      assert.notEqual(tones[i], tones[i - 1], `column ${col} repeats tone ${tones[i]} in adjacent rows`);
    }
  }
});

test('scatter map uses every tone at least twice across the 20 blocks', () => {
  const counts = new Map<number, number>();
  for (const toneIndex of PIGMENT_SCATTER_MAP) {
    counts.set(toneIndex, (counts.get(toneIndex) ?? 0) + 1);
  }
  assert.equal(counts.size, pigmentScale.length, 'every pigment tone should appear at least once');
  for (const [toneIndex, count] of counts) {
    assert.ok(count >= 2, `tone ${toneIndex} only appears ${count} time(s)`);
  }
});
