/**
 * Framing for the record locator (a picture: nothing pans or zooms it).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOCATOR_MAX_SCALE,
  defaultLocatorView,
  locatorCanvasTransform,
  neighborhoodLocatorView,
} from './record-locator-view';

test('neighborhood opening scale is a region, not a town lot', () => {
  const view = neighborhoodLocatorView(40, 50, 720, 420);
  assert.equal(view.scale, 2.15);
});

test('the neighborhood frame puts the pin at the centre of the box', () => {
  const view = neighborhoodLocatorView(40, 50, 720, 420);
  assert.equal(view.panX + 0.4 * 720 * view.scale, 360);
  assert.equal(view.panY + 0.5 * 420 * view.scale, 210);
});

test('scale is clamped', () => {
  assert.equal(neighborhoodLocatorView(50, 50, 720, 420, 99).scale, LOCATOR_MAX_SCALE);
});

test('default view is identity scale at origin', () => {
  assert.deepEqual(defaultLocatorView(), { scale: 1, panX: 0, panY: 0 });
  assert.equal(locatorCanvasTransform(defaultLocatorView()), 'translate(0px, 0px) scale(1)');
});
