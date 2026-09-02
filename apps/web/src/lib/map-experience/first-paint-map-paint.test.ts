/**
 * First-paint map paint expressions mirror Door pin plate rules.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandPalette } from '@repo/ui';
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

test('first-paint color uses Page Sand for records and copper for walks', () => {
  const expr = firstPaintPointColorExpression();
  assert.equal(expr[0], 'case');
  assert.equal(expr[2], brandPalette.copperPin);
  assert.equal(expr[3], brandPalette.pageSand);
  assert.notEqual(expr[3], brandPalette.archivePaper);
  assert.equal(FIRST_PAINT_MAP_MAX_ZOOM, 12);
  assert.equal(EXPLORE_GL_ENTITY_MAX_ZOOM, FIRST_PAINT_MAP_MAX_ZOOM + 0.001);
});
