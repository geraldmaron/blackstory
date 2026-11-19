/**
 * The wall's dignity rules as numbers: names never vanish, every name is held legible long enough
 * to read, the still wall is composed, and a press finds the name under it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attentionFalloff,
  hitTestMemorialWall,
  MEMORIAL_NAME_HOLD_MIN_S,
  MEMORIAL_NAME_RISE_S,
  MEMORIAL_WALL_LAYERS,
  memorialNameAlpha,
  memorialNameStillAlpha,
  memorialWallSlot,
  surfaceEnvelope,
  wrapDrift,
} from './memorial-wall-field';

test('a name never vanishes: every layer rests at a visible trace below its peak', () => {
  for (let layer = 0; layer < MEMORIAL_WALL_LAYERS.length; layer += 1) {
    const spec = MEMORIAL_WALL_LAYERS[layer]!;
    assert.ok(spec.trace > 0 && spec.trace < spec.peak);
    const slot = memorialWallSlot(layer, 0.5, 0.25);
    for (let t = 0; t < slot.period * 2; t += 0.25) {
      const alpha = memorialNameAlpha(slot, t);
      assert.ok(alpha >= spec.trace - 1e-9, `layer ${spec.id} dipped below trace at ${t}s`);
      assert.ok(alpha <= spec.peak + 1e-9);
    }
  }
});

test('each name is held at full legibility for at least the minimum hold', () => {
  const slot = memorialWallSlot(2, 0, 0);
  const held = [];
  for (let u = 0; u < slot.period; u += 0.05) {
    if (surfaceEnvelope(u, slot.hold) === 1) held.push(u);
  }
  const span = held[held.length - 1]! - held[0]!;
  assert.ok(span >= MEMORIAL_NAME_HOLD_MIN_S - 0.1, `held ${span}s`);
  assert.ok(held[0]! >= MEMORIAL_NAME_RISE_S - 0.05, 'a name eases in rather than appearing');
});

test('the envelope eases monotonically in and out with no flicker', () => {
  const hold = 5;
  let previous = 0;
  for (let u = 0; u <= MEMORIAL_NAME_RISE_S; u += 0.05) {
    const v = surfaceEnvelope(u, hold);
    assert.ok(v >= previous - 1e-12);
    previous = v;
  }
  assert.equal(surfaceEnvelope(-1, hold), 0);
  assert.equal(surfaceEnvelope(1000, hold), 0);
});

test('the still wall is composed: every name visible, a share held fully legible', () => {
  for (let layer = 0; layer < MEMORIAL_WALL_LAYERS.length; layer += 1) {
    const spec = MEMORIAL_WALL_LAYERS[layer]!;
    const slot = memorialWallSlot(layer, 0.3, 0.3);
    const values = Array.from({ length: 100 }, (_, i) => memorialNameStillAlpha(slot, i / 100));
    assert.ok(values.every((v) => v > spec.trace));
    const legible = values.filter((v) => v === spec.peak).length;
    assert.ok(legible > 0 && legible < 50, `layer ${spec.id} legible share ${legible}%`);
  }
});

test('attention is strongest under the hand and gone at the radius', () => {
  assert.equal(attentionFalloff(0, 150), 1);
  assert.equal(attentionFalloff(150, 150), 0);
  assert.ok(attentionFalloff(75, 150) > 0 && attentionFalloff(75, 150) < 1);
  assert.equal(attentionFalloff(10, 0), 0);
});

test('drift wraps names from the top back to the bottom', () => {
  const span = 1000;
  const margin = 40;
  assert.equal(wrapDrift(100, 0, span, margin), 100);
  assert.equal(wrapDrift(100, 50, span, margin), 50);
  // 10px past the top margin (-40) it re-enters 10px above the bottom margin (960).
  assert.equal(wrapDrift(0, 50, span, margin), 950);
});

test('a press finds the name under it, preferring the nearer layer', () => {
  const targets = [
    { x: 100, y: 100, halfWidth: 60, halfHeight: 10, layer: 0, alpha: 0.3 },
    { x: 110, y: 104, halfWidth: 80, halfHeight: 16, layer: 2, alpha: 0.1 },
    { x: 400, y: 400, halfWidth: 60, halfHeight: 10, layer: 2, alpha: 0.9 },
  ];
  assert.equal(hitTestMemorialWall(targets, 105, 100), 1);
  assert.equal(hitTestMemorialWall(targets, 400, 402), 2);
  assert.equal(hitTestMemorialWall(targets, 700, 700), -1);
});

test('every layer is fully legible at its peak: 4.5:1 ink on canvas in both themes', () => {
  // --ds-ink on --ds-canvas from packages/ui/src/styles/tokens.css (light, then dark).
  const themes = [
    { ink: [0x0a, 0x0a, 0x0a], canvas: [0xf8, 0xf4, 0xec] },
    { ink: [0xf4, 0xef, 0xe5], canvas: [0x13, 0x11, 0x10] },
  ];
  const lum = (rgb: readonly number[]) => {
    const [r, g, b] = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const { ink, canvas } of themes) {
    for (const layer of MEMORIAL_WALL_LAYERS) {
      const shown = ink.map((c, i) => c * layer.peak + canvas[i]! * (1 - layer.peak));
      const [hi, lo] = [lum(shown), lum(canvas)].sort((a, b) => b - a) as [number, number];
      const ratio = (hi + 0.05) / (lo + 0.05);
      assert.ok(ratio >= 4.5, `layer ${layer.id} peaks at ${ratio.toFixed(2)}:1`);
    }
  }
});
