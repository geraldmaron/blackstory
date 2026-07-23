/**
 * Tests for collision-aware memorial name packing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packMemorialNames } from './pack-memorial-names';

test('packMemorialNames never overlaps placed labels', () => {
  const names = [
    'Trayvon Martin',
    'Emmett Till',
    'Medgar Evers',
    'Breonna Taylor',
    'George Floyd',
    'Tamir Rice',
    'Sandra Bland',
    'Ahmaud Arbery',
  ];
  const placed = packMemorialNames({
    names,
    fonts: ['Caveat', 'Patrick Hand'],
    canvasWidth: 1200,
    canvasHeight: 900,
    seed: 42,
    measure: (name, _font, size) => ({
      width: Math.max(40, name.length * size * 0.55),
      height: size * 1.2,
    }),
  });

  assert.ok(placed.length >= 4);
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i]!;
      const b = placed[j]!;
      const aW = Math.max(40, a.name.length * a.fontSizePx * 0.55);
      const aH = a.fontSizePx * 1.2;
      const bW = Math.max(40, b.name.length * b.fontSizePx * 0.55);
      const bH = b.fontSizePx * 1.2;
      const gap = 10;
      const overlap = !(
        a.cx + aW / 2 + gap <= b.cx - bW / 2 ||
        a.cx - aW / 2 >= b.cx + bW / 2 + gap ||
        a.cy + aH / 2 + gap <= b.cy - bH / 2 ||
        a.cy - aH / 2 >= b.cy + bH / 2 + gap
      );
      assert.equal(overlap, false, `${a.name} overlaps ${b.name}`);
    }
  }
});

test('packMemorialNames is deterministic for a fixed seed', () => {
  const args = {
    names: ['Trayvon Martin', 'Emmett Till', 'Medgar Evers'],
    fonts: ['Caveat'],
    canvasWidth: 800,
    canvasHeight: 600,
    seed: 7,
    measure: (name: string, _font: string, size: number) => ({
      width: name.length * size * 0.5,
      height: size,
    }),
  } as const;
  const a = packMemorialNames(args);
  const b = packMemorialNames(args);
  assert.deepEqual(a, b);
});
