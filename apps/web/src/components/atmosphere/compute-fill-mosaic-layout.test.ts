/**
 * Unit tests for fill-mosaic layout (complete rows, denser on larger viewports).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFillMosaicLayout } from './compute-fill-mosaic-layout';

test('computeFillMosaicLayout returns a complete rectangle within the pool', () => {
  const layout = computeFillMosaicLayout(1200, 640, 233);
  assert.equal(layout.density, layout.columns * layout.rows);
  assert.ok(layout.density <= 233);
  assert.ok(layout.columns >= 3);
  assert.ok(layout.rows >= 3);
});

test('larger viewports request more tiles than compact ones', () => {
  const phone = computeFillMosaicLayout(390, 520, 233);
  const desktop = computeFillMosaicLayout(1440, 720, 233);
  const wide = computeFillMosaicLayout(1920, 900, 233);
  assert.ok(desktop.density > phone.density);
  assert.ok(wide.density >= desktop.density);
});

test('layout never exceeds pool size', () => {
  const layout = computeFillMosaicLayout(2400, 1200, 40);
  assert.ok(layout.density <= 40);
  assert.equal(layout.density, layout.columns * layout.rows);
});

test('cells stay near portrait so faces are less likely to clip', () => {
  const layout = computeFillMosaicLayout(1440, 720, 233);
  const aspect = 1440 / layout.columns / (720 / layout.rows);
  assert.ok(aspect >= 0.55 && aspect <= 1.25, `unexpected aspect ${aspect}`);
});

test('ultra-wide masts pack denser than a mid desktop', () => {
  const desktop = computeFillMosaicLayout(1280, 700, 233);
  const ultra = computeFillMosaicLayout(2560, 1000, 233);
  assert.ok(ultra.density > desktop.density);
});
