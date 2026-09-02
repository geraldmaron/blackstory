/**
 * Pan/zoom math for the interactive record locator.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultLocatorView,
  locatorCanvasTransform,
  panLocatorView,
  wheelFactorForDelta,
  zoomLocatorViewAt,
} from './record-locator-view';

test('default view is identity scale at origin', () => {
  assert.deepEqual(defaultLocatorView(), { scale: 1, panX: 0, panY: 0 });
  assert.equal(locatorCanvasTransform(defaultLocatorView()), 'translate(0px, 0px) scale(1)');
});

test('zoom anchors to a pointer position', () => {
  const start = { scale: 1, panX: 0, panY: 0 };
  const zoomed = zoomLocatorViewAt(start, 2, 100, 50);
  assert.equal(zoomed.scale, 2);
  assert.equal(zoomed.panX, -100);
  assert.equal(zoomed.panY, -50);
});

test('zoom clamps at max scale', () => {
  const nearMax = { scale: 4.9, panX: 0, panY: 0 };
  const zoomed = zoomLocatorViewAt(nearMax, 1.5, 0, 0);
  assert.equal(zoomed.scale, 5);
});

test('pan accumulates deltas', () => {
  const moved = panLocatorView(defaultLocatorView(), 12, -8);
  assert.deepEqual(moved, { scale: 1, panX: 12, panY: -8 });
});

test('wheel factor respects direction', () => {
  assert.ok(wheelFactorForDelta(120) < 1);
  assert.ok(wheelFactorForDelta(-120) > 1);
  assert.equal(wheelFactorForDelta(0), 1);
});
