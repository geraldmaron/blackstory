/**
 * First-paint map paint expressions mirror Door pin plate rules.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandPalette } from '@repo/ui';
import { MARKER_ZOOM_SCALE_STOPS, markerRadiusExpression } from './marker-size';
import {
  blendFirstPaintWithKindExpression,
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

test('a zoom-scaled kind expression folds into one top-level zoom interpolate', () => {
  const kind = markerRadiusExpression() as unknown[];
  assert.equal(kind[0], 'interpolate');
  assert.deepEqual(kind[2], ['zoom']);
  const blended = blendFirstPaintWithKindExpression(
    markerRadiusExpression(),
    firstPaintPointRadiusExpression(),
  ) as unknown[];
  assert.equal(blended[0], 'interpolate');
  assert.deepEqual(blended[2], ['zoom']);
  assert.equal(blended[3], FIRST_PAINT_MAP_MAX_ZOOM);
  assert.deepEqual(blended[4], firstPaintPointRadiusExpression());
  assert.equal(blended[5], EXPLORE_GL_ENTITY_MAX_ZOOM);
  // The kind value at the handoff is the last marker zoom stop's output, not a nested interpolate.
  assert.deepEqual(blended[6], kind[kind.length - 1]);
  const nested = JSON.stringify(blended.slice(3)).match(/\["zoom"\]/g) ?? [];
  assert.equal(nested.length, 0, 'no zoom input may appear inside the stops');
});

test('the marker zoom scale ends at or before the first-paint handoff, so the fold is exact', () => {
  const last = MARKER_ZOOM_SCALE_STOPS[MARKER_ZOOM_SCALE_STOPS.length - 1]!;
  assert.ok(last[0] <= EXPLORE_GL_ENTITY_MAX_ZOOM);
});

test('a plain kind expression still blends as two stops', () => {
  const blended = blendFirstPaintWithKindExpression(
    ['literal', 1] as never,
    ['literal', 0] as never,
  ) as unknown[];
  assert.deepEqual(blended, [
    'interpolate',
    ['linear'],
    ['zoom'],
    FIRST_PAINT_MAP_MAX_ZOOM,
    ['literal', 0],
    EXPLORE_GL_ENTITY_MAX_ZOOM,
    ['literal', 1],
  ]);
});
