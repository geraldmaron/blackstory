/**
 * Unit tests for the scattered memorial names-wall field layout.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeNamesWallLayout } from './compute-names-wall-layout';

test('computeNamesWallLayout returns uneven slots within the pool', () => {
  const layout = computeNamesWallLayout(1440, 900, 1660, 'map-stage');
  assert.ok(layout.slots.length >= layout.density);
  assert.ok(layout.density <= 1660);
  assert.ok(layout.density >= 18);
  assert.ok(layout.slots.length > layout.density, 'field keeps vacant pockets');
});

test('larger viewports request more occupied names than compact ones', () => {
  const phone = computeNamesWallLayout(390, 720, 1660, 'map');
  const desktop = computeNamesWallLayout(1440, 900, 1660, 'map');
  assert.ok(desktop.density > phone.density);
});

test('layout never exceeds pool size', () => {
  const layout = computeNamesWallLayout(2400, 1400, 40, 'map');
  assert.ok(layout.density <= 40);
  assert.ok(layout.slots.length <= 40);
});

test('placements are irregular — not a uniform grid of equal cells', () => {
  const layout = computeNamesWallLayout(1440, 900, 1660, 'map-stage');
  const xs = new Set(layout.slots.map((slot) => Math.round(slot.xPct)));
  const ys = new Set(layout.slots.map((slot) => Math.round(slot.yPct)));
  assert.ok(xs.size > 8, 'x positions should vary widely');
  assert.ok(ys.size > 8, 'y positions should vary widely');

  const scales = new Set(layout.slots.map((slot) => slot.scale));
  assert.ok(scales.size > 3, 'scales should vary (hierarchy)');

  const weights = new Set(layout.slots.map((slot) => slot.weight));
  assert.ok(weights.has('whisper'));
  assert.ok(weights.has('clear') || weights.has('accent'));

  for (const slot of layout.slots) {
    assert.ok(slot.rotateDeg >= -2 && slot.rotateDeg <= 2);
    assert.ok(slot.ink > 0 && slot.ink <= 0.5);
  }
});

test('layout is seed-stable', () => {
  const a = computeNamesWallLayout(1200, 800, 1660, 'map-stage');
  const b = computeNamesWallLayout(1200, 800, 1660, 'map-stage');
  assert.deepEqual(a, b);
});
