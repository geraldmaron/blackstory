/**
 * The locator projection, and the one invariant that cannot be checked by reading either file
 * alone: `public/geo/us-locator.svg` was drawn through THIS module.
 *
 * The pin is positioned as a percentage of the projected canvas and the ground is that same canvas
 * as a CSS mask. If a constant here moves and the asset is not regenerated, nothing throws, nothing
 * logs, and every record in the archive quietly points at the wrong part of the country. That is
 * the failure this file exists to make loud.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  locatorPinPercent,
  projectAlbersUsa,
  US_LOCATOR_HEIGHT,
  US_LOCATOR_WIDTH,
} from './albers-usa';

const here = dirname(fileURLToPath(import.meta.url));
const locatorSvg = readFileSync(join(here, '../../../public/geo/us-locator.svg'), 'utf8');

test('the committed ground was drawn on the canvas this module projects onto', () => {
  assert.match(
    locatorSvg,
    new RegExp(`viewBox="0 0 ${US_LOCATOR_WIDTH} ${US_LOCATOR_HEIGHT}"`),
    'regenerate public/geo/us-locator.svg — pnpm --filter @repo/web locator:build',
  );
});

/**
 * Known cities, to within a canvas unit. Coarse on purpose: the assertion is that the composition
 * is wired up correctly, not that the arithmetic reproduces d3 bit for bit.
 */
test('the lower 48 land where they belong on the canvas', () => {
  const cases: readonly [string, number, number, number, number][] = [
    ['Seattle', -122.33, 47.61, 159, 37],
    ['San Diego', -117.16, 32.72, 161, 326],
    ['Portland, Maine', -70.25, 43.66, 831, 110],
    ['Washington, DC', -77.04, 38.91, 760, 219],
    ['Mound Bayou, Mississippi', -90.73, 33.88, 570, 339],
  ];
  for (const [name, lng, lat, x, y] of cases) {
    const point = projectAlbersUsa(lng, lat);
    assert.ok(point, `${name} must project`);
    assert.ok(Math.abs(point.x - x) < 2, `${name} x: ${point.x} vs ${x}`);
    assert.ok(Math.abs(point.y - y) < 2, `${name} y: ${point.y} vs ${y}`);
  }
});

test('Alaska and Hawaii go to their insets, not into the Pacific', () => {
  const anchorage = projectAlbersUsa(-149.9, 61.22);
  const honolulu = projectAlbersUsa(-157.86, 21.31);
  assert.ok(anchorage && honolulu);
  // Both insets sit below and left of the continental mass: y past the Gulf, x west of Texas.
  for (const point of [anchorage, honolulu]) {
    assert.ok(point.y > 400, `inset should sit low on the canvas, got ${point.y}`);
    assert.ok(point.x < 340, `inset should sit left on the canvas, got ${point.x}`);
  }
  // And they are not on top of each other, which a missed translate would produce.
  assert.ok(Math.abs(anchorage.x - honolulu.x) > 60);
});

/**
 * The Aleutian case, which is why each conic carries a geographic domain as well as a clip
 * rectangle. Longitude +172 is real US territory in the eastern hemisphere; offered to the
 * lower-48 conic it projects to a position that falls INSIDE that conic's clip rectangle, off the
 * California coast. The first draw of the asset had a stray wedge sitting there.
 */
test('an eastern-hemisphere coordinate is never claimed by the lower 48', () => {
  const aleutian = projectAlbersUsa(172.4, 52.9);
  if (aleutian) {
    assert.ok(
      aleutian.y > 380,
      'if drawn at all it belongs in the Alaska inset, not off California',
    );
  }
});

test('a coordinate outside the country is refused rather than pinned somewhere plausible', () => {
  assert.equal(projectAlbersUsa(-10.8, 6.3), null, 'Monrovia');
  assert.equal(projectAlbersUsa(0.13, 51.5), null, 'London');
  assert.equal(projectAlbersUsa(-43.2, -22.9), null, 'Rio de Janeiro');
  assert.equal(projectAlbersUsa(Number.NaN, 40), null);
  assert.equal(projectAlbersUsa(-95, 200), null);
});

test('the percentage form is the canvas position, so CSS and the mask share one frame', () => {
  const point = projectAlbersUsa(-77.04, 38.91);
  const percent = locatorPinPercent(-77.04, 38.91);
  assert.ok(point && percent);
  const rawX = (point.x / US_LOCATOR_WIDTH) * 100;
  const rawY = (point.y / US_LOCATOR_HEIGHT) * 100;
  assert.equal(percent.x, Math.round(rawX * 10000) / 10000);
  assert.equal(percent.y, Math.round(rawY * 10000) / 10000);
  assert.equal(locatorPinPercent(-10.8, 6.3), null);
});

test('pin percentages round to four decimal places for hydration parity', () => {
  const cases: readonly [number, number][] = [
    [-77.04, 38.91],
    [-122.33, 47.61],
    [-149.9, 61.22],
  ];
  for (const [lng, lat] of cases) {
    const percent = locatorPinPercent(lng, lat);
    assert.ok(percent, `${lng},${lat} must project`);
    for (const axis of [percent.x, percent.y] as const) {
      const rounded = Math.round(axis * 10000) / 10000;
      assert.equal(axis, rounded, `${lng},${lat} axis must have at most four decimal places`);
      // FirstPaintPinPlate uses toFixed(4) so SSR and client style strings match.
      assert.match(`${axis.toFixed(4)}%`, /^\d+\.\d{4}%$/);
    }
  }
});
