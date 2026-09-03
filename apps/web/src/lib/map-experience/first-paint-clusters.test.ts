import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FIRST_PAINT_CLUSTER_MIN_POINTS,
  FIRST_PAINT_CLUSTER_RADIUS_UNITS,
  firstPaintClusterTier,
  groupFirstPaintPins,
} from './first-paint-clusters';

test('pins within one radius fold into a cluster at their centroid', () => {
  // 1% of board width is 9.6 units; three pins 1% apart sit well inside a 39-unit radius.
  const { clusters, grouped } = groupFirstPaintPins([
    { x: 50, y: 50 },
    { x: 51, y: 50 },
    { x: 52, y: 50 },
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.count, 3);
  assert.equal(clusters[0]?.x, 51);
  assert.equal(clusters[0]?.y, 50);
  assert.deepEqual([...grouped].sort(), [0, 1, 2]);
});

test('a lone pin stays a pin', () => {
  const { clusters, grouped } = groupFirstPaintPins([
    { x: 10, y: 10 },
    { x: 80, y: 80 },
  ]);
  assert.equal(clusters.length, 0);
  assert.equal(grouped.size, 0);
  assert.equal(FIRST_PAINT_CLUSTER_MIN_POINTS, 2);
});

test('excluded pins (walks, the focus record) and unprojected pins are never grouped', () => {
  const { clusters, grouped } = groupFirstPaintPins(
    [{ x: 50, y: 50 }, { x: 50.5, y: 50 }, null, { x: 51, y: 50 }],
    { exclude: new Set([1]) },
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.count, 2);
  assert.ok(!grouped.has(1));
  assert.ok(!grouped.has(2));
});

test('grouping is deterministic and index-ordered', () => {
  const points = Array.from({ length: 40 }, (_, i) => ({ x: 20 + (i % 8) * 0.5, y: 30 + i * 0.1 }));
  const a = groupFirstPaintPins(points);
  const b = groupFirstPaintPins(points);
  assert.deepEqual(a.clusters, b.clusters);
  assert.deepEqual([...a.grouped], [...b.grouped]);
});

test('the radius is the live cluster radius scaled to the board', () => {
  // 52px on a 1280px-wide plate, on a 960-unit board.
  assert.equal(FIRST_PAINT_CLUSTER_RADIUS_UNITS, Math.round((52 * 960) / 1280));
});

test('cluster tiers step at the live count breakpoints', () => {
  assert.equal(firstPaintClusterTier(2), 1);
  assert.equal(firstPaintClusterTier(9), 1);
  assert.equal(firstPaintClusterTier(10), 2);
  assert.equal(firstPaintClusterTier(50), 3);
  assert.equal(firstPaintClusterTier(200), 4);
});

test('the pin plate groups its board the way the live plate groups the national frame', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const plate = readFileSync(
    fileURLToPath(new URL('../../app/first-paint-pin-plate.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(plate, /groupFirstPaintPins\(projected, \{ exclude \}\)/);
  // Every pin stays in the DOM in index order: a grouped pin is hidden, never dropped.
  assert.match(plate, /grouped \? 'ds-first-paint-pin--grouped' : ''/);
  assert.match(plate, /className="ds-first-paint-cluster"/);
  assert.match(plate, /data-tier=\{firstPaintClusterTier\(cluster\.count\)\}/);
  // Walks and the focus record read as singles on the plate, so they stay singles on the board.
  assert.match(plate, /if \(isPinPlateWalk\(feature, linkRecords\)\) exclude\.add\(index\)/);
});
