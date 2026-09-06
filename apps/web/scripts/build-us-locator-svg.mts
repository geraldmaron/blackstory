/**
 * Draws the two static grounds the archive pins into:
 *
 *   - `public/geo/us-locator.svg` — Albers USA, the record page's WHERE block (albers-usa.ts).
 *   - `public/geo/us-conus-mercator.svg` — Web Mercator over the CONUS bounds box, Explore's
 *     first-paint board (conus-mercator.ts): the plate's own projection, so the board can sit
 *     under the live plate at the same frame and hand off as a crossfade (repo-27uao).
 *
 * Run: pnpm --filter @repo/web locator:build
 *
 * Both assets are committed. They are regenerated only when a projection module or the source
 * geometry changes, and `albers-usa.test.ts` / `conus-mercator.test.ts` fail loudly if a
 * projection moves without the redraw.
 *
 * WHY AN ASSET RATHER THAN A COMPONENT. The outline is identical on every record in the archive,
 * so shipping it through the RSC payload would repeat ~30KB per page for geometry the browser
 * could have cached once. As a file it is fetched once and reused across every record, costs the
 * JS bundle nothing, and is rendered through `mask-image` so its colour still comes from a theme
 * token instead of being baked in — which is why the shapes below are drawn in flat black at two
 * different alphas. The mask reads alpha, not colour: land at 0.32 becomes a wash, the state
 * hairlines at 1 become full-strength ink, in whichever theme the reader is in.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  projectAlbersUsa,
  US_LOCATOR_HEIGHT,
  US_LOCATOR_WIDTH,
} from '../src/lib/map-experience/albers-usa.ts';
import {
  CONUS_MERCATOR_HEIGHT,
  CONUS_MERCATOR_WIDTH,
  projectConusMercator,
} from '../src/lib/map-experience/conus-mercator.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '../public/geo/us-states-20m.geojson');
const TARGET = join(here, '../public/geo/us-locator.svg');
const MERCATOR_TARGET = join(here, '../public/geo/us-conus-mercator.svg');

/** Off the plate's opening frame (and outside the Mercator box), so off the Mercator board. */
const OFF_CONUS = new Set(['AK', 'HI']);

/**
 * Douglas-Peucker tolerance, in canvas units.
 *
 * The locator is drawn at roughly 200-400 CSS px against a 960-unit canvas, so one canvas unit is
 * well under half a device pixel. At 0.9 the silhouette is indistinguishable from the source at
 * every size this asset is ever displayed, and the file drops by an order of magnitude.
 */
const TOLERANCE = 0.9;

type Ring = { x: number; y: number }[];

function perpendicularDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.hypot(dx, dy);
}

function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length < 3) return ring;
  let worst = 0;
  let index = 0;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  for (let i = 1; i < ring.length - 1; i += 1) {
    const distance = perpendicularDistance(ring[i]!, first, last);
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }
  if (worst <= tolerance) return [first, last];
  return [
    ...simplify(ring.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(ring.slice(index), tolerance),
  ];
}

/** Rounded to one decimal: a tenth of a canvas unit is far below one device pixel at any size. */
function ringToPath(ring: Ring): string {
  const round = (value: number) => Math.round(value * 10) / 10;
  const parts = ring.map(
    (point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`,
  );
  return `${parts.join('')}Z`;
}

function ringsOf(geometry: { type: string; coordinates: unknown }): number[][][] {
  if (geometry.type === 'Polygon') return geometry.coordinates as number[][][];
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).flat();
  }
  return [];
}

type StateFeature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

const collection = JSON.parse(readFileSync(SOURCE, 'utf8')) as { features: StateFeature[] };

type Projection = (lng: number, lat: number) => { x: number; y: number } | null;

function draw(
  name: string,
  target: string,
  width: number,
  height: number,
  project: Projection,
  include: (feature: StateFeature) => boolean,
): void {
  const paths: string[] = [];
  let sourcePoints = 0;
  let keptPoints = 0;

  for (const feature of collection.features) {
    if (!include(feature)) continue;
    for (const ring of ringsOf(feature.geometry)) {
      sourcePoints += ring.length;
      const projected: Ring = [];
      for (const [lng, lat] of ring as [number, number][]) {
        const point = project(lng, lat);
        // A ring vertex the projection rejects is a genuine hole in it (a fragment of a territory
        // outside every clip, or outside the Mercator box). Dropping the vertex rather than the
        // ring keeps the rest of the shape drawable instead of losing a whole state to one stray
        // coordinate.
        if (point) projected.push(point);
      }
      if (projected.length < 4) continue;
      const reduced = simplify(projected, TOLERANCE);
      if (reduced.length < 4) continue;
      keptPoints += reduced.length;
      paths.push(ringToPath(reduced));
    }
  }

  const shapes = paths.join('');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    // Generated by apps/web/scripts/build-us-locator-svg.mts — do not hand-edit.
    // Alpha, not colour, is the payload: this file is consumed as a CSS mask.
    `<g fill="#000" fill-opacity="0.32" fill-rule="evenodd">`,
    `<path d="${shapes}"/>`,
    `</g>`,
    `<g fill="none" stroke="#000" stroke-opacity="1" stroke-width="1.1" stroke-linejoin="round">`,
    `<path d="${shapes}"/>`,
    `</g>`,
    `</svg>`,
    '',
  ].join('');

  writeFileSync(target, svg);
  console.log(
    `${name}: ${paths.length} rings, ${sourcePoints} -> ${keptPoints} points, ${(svg.length / 1024).toFixed(1)}KB`,
  );
}

draw('us-locator.svg', TARGET, US_LOCATOR_WIDTH, US_LOCATOR_HEIGHT, projectAlbersUsa, () => true);
draw(
  'us-conus-mercator.svg',
  MERCATOR_TARGET,
  CONUS_MERCATOR_WIDTH,
  CONUS_MERCATOR_HEIGHT,
  projectConusMercator,
  (feature) => !OFF_CONUS.has(String(feature.properties.postalCode)),
);
