import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPLORE_CLUSTER_CONFIG } from './dignity-style';
import {
  FIRST_PAINT_CLUSTER_MIN_POINTS,
  FIRST_PAINT_CLUSTER_RADIUS_TILE_UNITS,
  FIRST_PAINT_CLUSTER_ZOOMS,
  firstPaintClusterTier,
  groupFirstPaintPins,
} from './first-paint-clusters';

test('pins within the plate’s cluster radius fold into one cluster at their centroid', () => {
  // At zoom 3 one degree of longitude is ~11px; 52px of radius covers these three.
  const { clusters, grouped } = groupFirstPaintPins(
    [
      { lng: -90, lat: 38 },
      { lng: -89.9, lat: 38 },
      { lng: -89.8, lat: 38 },
    ],
    3,
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.count, 3);
  assert.ok(Math.abs((clusters[0]?.lng ?? 0) - -89.9) < 1e-6);
  assert.ok(Math.abs((clusters[0]?.lat ?? 0) - 38) < 1e-6);
  assert.deepEqual([...grouped].sort(), [0, 1, 2]);
});

test('a lone pin stays a pin, and so do pins that only meet at a closer zoom', () => {
  const points = [
    { lng: -120, lat: 40 },
    { lng: -75, lat: 40 },
  ];
  const wide = groupFirstPaintPins(points, 3);
  assert.equal(wide.clusters.length, 0);
  assert.equal(wide.grouped.size, 0);
  // Half a degree apart: one disc at the national floor, two discs at a locality zoom.
  const near = [
    { lng: -90, lat: 38 },
    { lng: -89.5, lat: 38 },
  ];
  assert.equal(groupFirstPaintPins(near, 3).clusters.length, 1);
  assert.equal(groupFirstPaintPins(near, 8).clusters.length, 0);
  assert.equal(FIRST_PAINT_CLUSTER_MIN_POINTS, 2);
});

test('unprojected pins are never grouped, and grouped is exactly the pins not left single', () => {
  const { clusters, grouped } = groupFirstPaintPins(
    [{ lng: -90, lat: 38 }, null, { lng: -89.95, lat: 38 }, { lng: -70, lat: 44 }],
    3,
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.count, 2);
  assert.deepEqual([...grouped].sort(), [0, 2]);
});

test('grouping is deterministic for a given input order', () => {
  const points = Array.from({ length: 60 }, (_, i) => ({
    lng: -100 + (i % 8) * 0.3,
    lat: 35 + Math.floor(i / 8) * 0.2,
  }));
  const a = groupFirstPaintPins(points, 3);
  const b = groupFirstPaintPins(points, 3);
  assert.deepEqual(a.clusters, b.clusters);
  assert.deepEqual([...a.grouped], [...b.grouped]);
});

test('the parameters are MapLibre’s own, scaled the way its GeoJSON source scales them', () => {
  // `_pixelsToTileUnits`: 52px on a 512px tile, in an 8192-unit extent.
  assert.equal(
    FIRST_PAINT_CLUSTER_RADIUS_TILE_UNITS,
    (EXPLORE_CLUSTER_CONFIG.clusterRadius * 8192) / 512,
  );
  assert.deepEqual([...FIRST_PAINT_CLUSTER_ZOOMS], [3, 4]);
});

test('cluster tiers step at the live count breakpoints', () => {
  assert.equal(firstPaintClusterTier(2), 1);
  assert.equal(firstPaintClusterTier(9), 1);
  assert.equal(firstPaintClusterTier(10), 2);
  assert.equal(firstPaintClusterTier(50), 3);
  assert.equal(firstPaintClusterTier(200), 4);
});

test('the pin plate carries both opening-frame patterns and lets the viewport pick one', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const plate = readFileSync(
    fileURLToPath(new URL('../../app/first-paint-pin-plate.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(plate, /FIRST_PAINT_CLUSTER_ZOOMS\.map/);
  assert.match(plate, /groupFirstPaintPins\(points, zoom\)/);
  // Every pin stays in the DOM in index order: a grouped pin is hidden, never dropped.
  assert.match(plate, /ds-first-paint-pin--in-z\$\{zoom\}/);
  assert.match(plate, /className="ds-first-paint-cluster"/);
  assert.match(plate, /data-zoom=\{zoom\}/);
  assert.match(plate, /data-tier=\{firstPaintClusterTier\(cluster\.count\)\}/);
});
