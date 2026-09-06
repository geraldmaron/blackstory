/**
 * The first-paint board's projection, and the one invariant that cannot be checked by reading
 * either file alone: `public/geo/us-conus-mercator.svg` was drawn through THIS module. If the
 * bounds or the canvas move and the asset is not regenerated, nothing throws and every pin on
 * Explore's first paint quietly sits on the wrong part of the country. Loud here instead.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CONUS_MERCATOR_ASPECT,
  CONUS_MERCATOR_HEIGHT,
  CONUS_MERCATOR_WIDTH,
  conusBoxPxAtZoom,
  conusPinPercent,
  projectConusMercator,
} from './conus-mercator';

const here = dirname(fileURLToPath(import.meta.url));
const boardSvg = readFileSync(join(here, '../../../public/geo/us-conus-mercator.svg'), 'utf8');

test('the committed board was drawn on the canvas this module projects onto', () => {
  assert.match(
    boardSvg,
    new RegExp(`viewBox="0 0 ${CONUS_MERCATOR_WIDTH} ${CONUS_MERCATOR_HEIGHT}"`),
    'regenerate public/geo/us-conus-mercator.svg — pnpm --filter @repo/web locator:build',
  );
  // Alaska and Hawaii are off the plate's opening frame, so they are off the board too.
  assert.doesNotMatch(boardSvg, /AK|HI/);
});

test('the canvas has the bounds box’s own Mercator aspect', () => {
  // (-125.2 … -66.5) is 58.7° of longitude; 24.2°N … 49.5°N spans 0.5597 of Mercator height.
  assert.ok(Math.abs(CONUS_MERCATOR_ASPECT - 1.8241) < 0.0005, String(CONUS_MERCATOR_ASPECT));
  assert.equal(CONUS_MERCATOR_HEIGHT, 526.29);
});

/** Known cities, to a hundredth of a percent, worked out separately from the Mercator formula. */
test('cities land where they belong on the board', () => {
  const cases: readonly [string, number, number, number, number][] = [
    ['Seattle', -122.33, 47.61, 4.89, 8.87],
    ['San Diego', -117.16, 32.72, 13.7, 69.84],
    ['Minneapolis', -93.27, 44.98, 54.4, 20.71],
    ['Miami', -80.19, 25.76, 76.68, 94.65],
    ['Boston', -71.06, 42.36, 92.23, 31.96],
  ];
  for (const [name, lng, lat, x, y] of cases) {
    const point = conusPinPercent(lng, lat);
    assert.ok(point, name);
    assert.ok(Math.abs(point.x - x) < 0.02, `${name} x ${point.x} ≠ ${x}`);
    assert.ok(Math.abs(point.y - y) < 0.02, `${name} y ${point.y} ≠ ${y}`);
  }
});

test('the box corners are the canvas corners', () => {
  assert.deepEqual(conusPinPercent(-125.2, 49.5), { x: 0, y: 0 });
  assert.deepEqual(conusPinPercent(-66.5, 24.2), { x: 100, y: 100 });
});

test('a point off the plate’s opening frame is off the board', () => {
  assert.equal(projectConusMercator(-149.9, 61.2), null); // Anchorage
  assert.equal(projectConusMercator(-157.86, 21.31), null); // Honolulu
  assert.equal(projectConusMercator(-10.8, 6.3), null); // Monrovia
  assert.equal(projectConusMercator(Number.NaN, 40), null);
});

test('the box is 668×366 CSS px at zoom 3, the plate’s national floor', () => {
  const { width, height } = conusBoxPxAtZoom(3);
  assert.ok(Math.abs(width - 667.88) < 0.05, String(width));
  assert.ok(Math.abs(height - 366.14) < 0.05, String(height));
  // One zoom level doubles it.
  assert.ok(Math.abs(conusBoxPxAtZoom(4).width - 2 * width) < 1e-6);
});
