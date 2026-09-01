/**
 * First-paint map paint expressions mirror Door pin plate rules.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plateForScheme } from './dignity-style';
import {
  EXPLORE_GL_ENTITY_MAX_ZOOM,
  FIRST_PAINT_MAP_MAX_ZOOM,
  firstPaintPointColorExpression,
  firstPaintPointRadiusExpression,
  holdingPlaceWalkExpression,
} from './first-paint-map-paint';

test('holding place walks match the holdingWalk feature flag', () => {
  assert.deepEqual(holdingPlaceWalkExpression(), ['==', ['get', 'holdingWalk'], true]);
});

test('first-paint radius uses walk and record sizes', () => {
  assert.deepEqual(firstPaintPointRadiusExpression(), [
    'case',
    holdingPlaceWalkExpression(),
    4.5,
    3.5,
  ]);
});

test('first-paint color branches on walk vs record ink', () => {
  const plate = plateForScheme('dark');
  const expr = firstPaintPointColorExpression(plate);
  assert.equal(expr[0], 'case');
  assert.equal(FIRST_PAINT_MAP_MAX_ZOOM, 12);
  assert.equal(EXPLORE_GL_ENTITY_MAX_ZOOM, FIRST_PAINT_MAP_MAX_ZOOM + 0.001);
});
