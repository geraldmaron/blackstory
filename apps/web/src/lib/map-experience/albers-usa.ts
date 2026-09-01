/**
 * Albers USA projection, for the record page's static locator.
 *
 * WHY THIS EXISTS RATHER THAN A MAP. The record rail's WHERE block answers one question — roughly
 * where in the country is this — and the page's own caveat right underneath it says the answer is
 * held to city precision and that exact addresses are never rendered. A live, tile-streaming,
 * tilt-capable camera is the wrong instrument for that question: it costs a GL context and a
 * network round trip to assert a sharpness the record explicitly disclaims. A locator states the
 * claim the archive can actually support, and it is a static picture, so it cannot tear, blink or
 * lose a race with the scroll position.
 *
 * The numbers are d3-geo's `geoAlbersUsa` composition, reproduced rather than depended on: the
 * whole point is a few hundred bytes of arithmetic in the client bundle instead of a projection
 * library. Lower 48 in an Albers conic; Alaska and Hawaii in their own conics, scaled and parked
 * in the standard insets below the southwest corner.
 *
 * `scripts/build-us-locator-svg.mts` draws `public/geo/us-locator.svg` through THIS module, so the
 * outline and the pin are projected by one implementation. They cannot drift apart; changing a
 * constant here and not regenerating the asset is caught by `albers-usa.test.ts`, which pins the
 * projected position of known cities against the committed viewBox.
 */

/** The projected canvas. Matches the `viewBox` of `public/geo/us-locator.svg`. */
export const US_LOCATOR_WIDTH = 960;
export const US_LOCATOR_HEIGHT = 500;

const RADIANS = Math.PI / 180;
const EPSILON = 1e-6;

/** d3's `scale` and `translate` for a 960x500 Albers USA. Every inset below is derived from these. */
const SCALE = 1070;
const TRANSLATE_X = 480;
const TRANSLATE_Y = 250;

export type LocatorPoint = { readonly x: number; readonly y: number };

type Conic = {
  /** Degrees added to longitude before projecting — d3's `rotate([lambda, 0])`. */
  readonly rotateLambda: number;
  readonly parallels: readonly [number, number];
  readonly center: readonly [number, number];
  readonly scale: number;
  readonly translate: readonly [number, number];
  /** [[minX, minY], [maxX, maxY]] in canvas units. A point outside belongs to another conic. */
  readonly clip: readonly [readonly [number, number], readonly [number, number]];
  /**
   * The geographic box this conic is allowed to answer for, as [minLng, maxLng, minLat, maxLat].
   *
   * The clip rectangle alone is not enough, and the Aleutians are the proof. The chain crosses the
   * antimeridian, so its western islands sit at longitude +172 — and the lower-48 conic, offered
   * every point first, happily projects +172 into a position that falls INSIDE its clip rectangle,
   * off the coast of California. The first draw of the asset had a stray wedge sitting in the
   * Pacific because of it. A conic has to refuse coordinates it has no business projecting before
   * the clip test can mean anything.
   */
  readonly domain: readonly [number, number, number, number];
};

/**
 * The three pieces, in the order a point is offered to them.
 *
 * Lower 48 first, because it is the overwhelming majority of the catalog and its clip rectangle
 * does not overlap either inset — a Mississippi point never has to be tested against Alaska.
 */
const LOWER_48: Conic = {
  rotateLambda: 96,
  parallels: [29.5, 45.5],
  center: [-0.6, 38.7],
  scale: SCALE,
  translate: [TRANSLATE_X, TRANSLATE_Y],
  clip: [
    [TRANSLATE_X - 0.455 * SCALE, TRANSLATE_Y - 0.238 * SCALE],
    [TRANSLATE_X + 0.455 * SCALE, TRANSLATE_Y + 0.238 * SCALE],
  ],
  domain: [-129, -64, 22, 51],
};

const ALASKA: Conic = {
  rotateLambda: 154,
  parallels: [55, 65],
  center: [-2, 58.5],
  scale: 0.35 * SCALE,
  translate: [TRANSLATE_X - 0.307 * SCALE, TRANSLATE_Y + 0.201 * SCALE],
  clip: [
    [TRANSLATE_X - 0.425 * SCALE + EPSILON, TRANSLATE_Y + 0.12 * SCALE + EPSILON],
    [TRANSLATE_X - 0.214 * SCALE - EPSILON, TRANSLATE_Y + 0.234 * SCALE - EPSILON],
  ],
  domain: [-180, -128, 50, 72],
};

const HAWAII: Conic = {
  rotateLambda: 157,
  parallels: [8, 18],
  center: [-3, 19.9],
  scale: SCALE,
  translate: [TRANSLATE_X - 0.205 * SCALE, TRANSLATE_Y + 0.212 * SCALE],
  clip: [
    [TRANSLATE_X - 0.214 * SCALE + EPSILON, TRANSLATE_Y + 0.166 * SCALE + EPSILON],
    [TRANSLATE_X - 0.115 * SCALE - EPSILON, TRANSLATE_Y + 0.234 * SCALE - EPSILON],
  ],
  domain: [-161, -153, 17, 24],
};

const CONICS: readonly Conic[] = [LOWER_48, ALASKA, HAWAII];

/** Conic equal-area forward, in radians, before scale and translate. */
function conicEqualAreaRaw(
  parallels: readonly [number, number],
  lambda: number,
  phi: number,
): LocatorPoint {
  const sy0 = Math.sin(parallels[0] * RADIANS);
  const n = (sy0 + Math.sin(parallels[1] * RADIANS)) / 2;
  const c = 1 + sy0 * (2 * n - sy0);
  const r0 = Math.sqrt(c) / n;
  const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
  return { x: r * Math.sin(lambda * n), y: r0 - r * Math.cos(lambda * n) };
}

/** Longitude after the conic's rotation, normalised back into [-180, 180]. */
function rotateLongitude(lng: number, delta: number): number {
  const rotated = (lng + delta) % 360;
  if (rotated > 180) return rotated - 360;
  if (rotated < -180) return rotated + 360;
  return rotated;
}

function projectThrough(conic: Conic, lng: number, lat: number): LocatorPoint {
  const raw = conicEqualAreaRaw(
    conic.parallels,
    rotateLongitude(lng, conic.rotateLambda) * RADIANS,
    lat * RADIANS,
  );
  // d3 folds `center` into the translate: the projected centre must land on the translate point,
  // and the y axis flips because SVG counts downward while the conic counts up.
  const origin = conicEqualAreaRaw(
    conic.parallels,
    rotateLongitude(conic.center[0], 0) * RADIANS,
    conic.center[1] * RADIANS,
  );
  return {
    x: conic.scale * raw.x + (conic.translate[0] - conic.scale * origin.x),
    y: conic.translate[1] + conic.scale * origin.y - conic.scale * raw.y,
  };
}

function withinDomain(conic: Conic, lng: number, lat: number): boolean {
  const [minLng, maxLng, minLat, maxLat] = conic.domain;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

function withinClip(conic: Conic, point: LocatorPoint): boolean {
  const [[minX, minY], [maxX, maxY]] = conic.clip;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Project a coordinate onto the locator canvas, or `null` when it falls outside every piece.
 *
 * `null` is a real answer, not a failure: the catalog is not promised to be domestic, and a record
 * in Liberia or Nova Scotia must not be drawn somewhere plausible-looking off the coast of Maine.
 * Callers render the place block without a locator rather than pinning a lie.
 */
export function projectAlbersUsa(lng: number, lat: number): LocatorPoint | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  for (const conic of CONICS) {
    if (!withinDomain(conic, lng, lat)) continue;
    const point = projectThrough(conic, lng, lat);
    if (withinClip(conic, point)) return point;
  }
  return null;
}

/** Decimal places for pin percentages — keeps SSR and client style strings identical. */
const PIN_PERCENT_DECIMALS = 4;

function roundPinPercent(value: number): number {
  const factor = 10 ** PIN_PERCENT_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** The same point as a percentage of the canvas, which is what CSS positioning wants. */
export function locatorPinPercent(lng: number, lat: number): LocatorPoint | null {
  const point = projectAlbersUsa(lng, lat);
  if (!point) return null;
  return {
    x: roundPinPercent((point.x / US_LOCATOR_WIDTH) * 100),
    y: roundPinPercent((point.y / US_LOCATOR_HEIGHT) * 100),
  };
}
