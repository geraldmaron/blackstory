/**
 * Validates the brand-mark construction grid: correct block counts, no
 * overlapping blocks, and letters that don't collide.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGlyphLayout, buildMarkLayout, buildSocialLayout } from './geometry.js';
import { glyphBCells } from './glyph.js';

function assertNoOverlap(blocks: readonly { x: number; y: number; size: number }[]) {
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      const overlapsX = a.x < b.x + b.size && b.x < a.x + a.size;
      const overlapsY = a.y < b.y + b.size && b.y < a.y + a.size;
      assert.ok(!(overlapsX && overlapsY), `blocks ${i} and ${j} overlap`);
    }
  }
}

test('buildGlyphLayout produces one block per filled glyph cell', () => {
  const layout = buildGlyphLayout();
  assert.equal(layout.blocks.length, glyphBCells().length);
  assert.equal(layout.blocks.length, 20);
});

test('buildGlyphLayout blocks stay within the reported viewBox', () => {
  const layout = buildGlyphLayout({ padding: 8 });
  for (const block of layout.blocks) {
    assert.ok(block.x >= 0 && block.x + block.size <= layout.width);
    assert.ok(block.y >= 0 && block.y + block.size <= layout.height);
  }
  assertNoOverlap(layout.blocks);
});

test('buildMarkLayout produces two full letterforms with no overlap', () => {
  const layout = buildMarkLayout();
  assert.equal(layout.blocks.length, 40);
  const first = layout.blocks.filter((b) => b.letter === 'first');
  const second = layout.blocks.filter((b) => b.letter === 'second');
  assert.equal(first.length, 20);
  assert.equal(second.length, 20);

  const firstMaxX = Math.max(...first.map((b) => b.x + b.size));
  const secondMinX = Math.min(...second.map((b) => b.x));
  assert.ok(secondMinX >= firstMaxX, 'second letter must start after the first letter ends');

  assertNoOverlap(layout.blocks);

  for (const block of layout.blocks) {
    assert.ok(block.x >= 0 && block.x + block.size <= layout.width);
    assert.ok(block.y >= 0 && block.y + block.size <= layout.height);
  }
});

test('buildMarkLayout is deterministic across calls', () => {
  const a = buildMarkLayout();
  const b = buildMarkLayout();
  assert.deepEqual(a, b);
});

test('buildSocialLayout centers the mark within the requested frame', () => {
  const frameWidth = 1200;
  const frameHeight = 630;
  const markHeight = 260;
  const social = buildSocialLayout(frameWidth, frameHeight, markHeight);
  const scaledWidth = social.width * social.scale;
  assert.ok(social.offsetX >= 0 && social.offsetX + scaledWidth <= frameWidth);
  assert.ok(social.offsetY >= 0 && social.offsetY + markHeight <= frameHeight);
});
