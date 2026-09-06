/**
 * Web Mercator over the CONUS bounds box, for Explore's first-paint board.
 *
 * The board under the live plate has to be the plate's own picture: same projection, same box,
 * same frame. Albers (the record locator's projection, albers-usa.ts) can never be that picture —
 * a conic equal-area board arcs the 49th parallel a tenth of its height where Mercator draws it
 * straight — so the handoff read as one map replaced by another on every load (repo-27uao).
 *
 * This module projects onto the box the plate opens on: `US_CONUS_BOUNDS`, which MapStage's
 * constructor fits to the canvas. A pin percent here and the plate's `project()` land on the same
 * screen pixel once the board is laid over that same fit (explore-map-underlay.css), which is what
 * lets the reveal be a crossfade between two identical maps instead of a cut between two
 * different ones.
 *
 * `scripts/build-us-locator-svg.mts` draws `public/geo/us-conus-mercator.svg` through THIS
 * module, and `conus-mercator.test.ts` pins the committed asset's viewBox and known cities
 * against it, so the projection cannot move without the redraw.
 */
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';

const DEGREES = Math.PI / 180;

/** Web Mercator's y for a latitude, in radians of world height (no clamp: CONUS is far from ±85°). */
function mercatorY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * DEGREES) / 2));
}

const [WEST, SOUTH, EAST, NORTH] = US_CONUS_BOUNDS;
const SPAN_X = (EAST - WEST) * DEGREES;
const SPAN_Y = mercatorY(NORTH) - mercatorY(SOUTH);
const TOP = mercatorY(NORTH);

/** Width over height of the CONUS bounds box in Web Mercator — the board's aspect ratio. */
export const CONUS_MERCATOR_ASPECT = SPAN_X / SPAN_Y;

/** The projected canvas. Matches the `viewBox` of `public/geo/us-conus-mercator.svg`. */
export const CONUS_MERCATOR_WIDTH = 960;
/** Two decimals, so the SVG viewBox, the CSS `aspect-ratio` and this module agree to the digit. */
export const CONUS_MERCATOR_HEIGHT =
  Math.round((CONUS_MERCATOR_WIDTH / CONUS_MERCATOR_ASPECT) * 100) / 100;

/** The Web Mercator world is this many CSS pixels wide at zoom 0 (MapLibre's tile size). */
const WORLD_PX_AT_ZOOM_0 = 512;

/** The bounds box's size in CSS pixels at a plate zoom — the size MapLibre draws it at. */
export function conusBoxPxAtZoom(zoom: number): {
  readonly width: number;
  readonly height: number;
} {
  const world = WORLD_PX_AT_ZOOM_0 * 2 ** zoom;
  return {
    width: (SPAN_X / (2 * Math.PI)) * world,
    height: (SPAN_Y / (2 * Math.PI)) * world,
  };
}

export type MercatorPoint = { readonly x: number; readonly y: number };

/**
 * A coordinate on the board canvas (0..WIDTH across, 0..HEIGHT down), or `null` outside the
 * bounds box. `null` is a real answer: a record in Alaska, Hawaii or abroad is off this frame on
 * the plate too, and the board must not draw it somewhere plausible-looking inside the box.
 */
export function projectConusMercator(lng: number, lat: number): MercatorPoint | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < WEST || lng > EAST || lat < SOUTH || lat > NORTH) return null;
  return {
    x: (((lng - WEST) * DEGREES) / SPAN_X) * CONUS_MERCATOR_WIDTH,
    y: ((TOP - mercatorY(lat)) / SPAN_Y) * CONUS_MERCATOR_HEIGHT,
  };
}

/** Decimal places for pin percentages — keeps SSR and client style strings identical. */
const PIN_PERCENT_DECIMALS = 4;

function roundPinPercent(value: number): number {
  const factor = 10 ** PIN_PERCENT_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** The same point as a percentage of the board, which is what CSS positioning wants. */
export function conusPinPercent(lng: number, lat: number): MercatorPoint | null {
  const point = projectConusMercator(lng, lat);
  if (!point) return null;
  return {
    x: roundPinPercent((point.x / CONUS_MERCATOR_WIDTH) * 100),
    y: roundPinPercent((point.y / CONUS_MERCATOR_HEIGHT) * 100),
  };
}
