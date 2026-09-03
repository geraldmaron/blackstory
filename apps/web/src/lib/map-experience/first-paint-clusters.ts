/**
 * Server-side grouping for the first-paint pin plate, so the static board reads as the same
 * pattern the live plate settles into. MapLibre aggregates nearby records at national zoom
 * (`EXPLORE_CLUSTER_CONFIG`, radius 52px, min 2); before it has painted, the Albers board used to
 * show all 4,101 records as loose discs, then the plate replaced them with copper count discs.
 * Two entity patterns, one after the other, on every load. This groups the board's pins the same
 * way — greedy, by index, within one radius — so the handoff is the same map settling, not a
 * different map arriving.
 *
 * Coordinates are the plate's own: percent of the 960×500 Albers locator (`locatorPinPercent`).
 * The radius is expressed in board units at a representative desktop width so the grouping
 * density matches the live plate at the national frame without knowing the viewport.
 */

export type FirstPaintPoint = {
  /** Percent across the 960-unit board. */
  readonly x: number;
  /** Percent down the 500-unit board. */
  readonly y: number;
};

export type FirstPaintCluster = {
  readonly x: number;
  readonly y: number;
  readonly count: number;
};

export type FirstPaintGrouping = {
  readonly clusters: readonly FirstPaintCluster[];
  /** Indexes (into the input) of every pin folded into a cluster. */
  readonly grouped: ReadonlySet<number>;
};

const BOARD_WIDTH = 960;
const BOARD_HEIGHT = 500;

/**
 * Live cluster radius (52px) at a 1280px-wide plate, in board units: 52 × 960 / 1280. Wider
 * viewports group a little more loosely than the plate will, narrower a little more tightly;
 * either way the board and the plate agree on the pattern, which is what the reader sees.
 */
export const FIRST_PAINT_CLUSTER_RADIUS_UNITS = 39;

/** Same floor as `EXPLORE_CLUSTER_CONFIG.clusterMinPoints`. */
export const FIRST_PAINT_CLUSTER_MIN_POINTS = 2;

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Groups pins within `radiusUnits` of one another. `null` entries (unprojected pins) and any
 * index in `exclude` (walks, the focus pin) are never grouped. Deterministic: seeds are taken in
 * index order and each pin joins the first cluster that reaches it.
 */
export function groupFirstPaintPins(
  points: readonly (FirstPaintPoint | null)[],
  options: {
    readonly radiusUnits?: number;
    readonly minPoints?: number;
    readonly exclude?: ReadonlySet<number>;
  } = {},
): FirstPaintGrouping {
  const radius = options.radiusUnits ?? FIRST_PAINT_CLUSTER_RADIUS_UNITS;
  const minPoints = options.minPoints ?? FIRST_PAINT_CLUSTER_MIN_POINTS;
  const exclude = options.exclude ?? new Set<number>();
  const radiusSq = radius * radius;

  // Board-unit coordinates, bucketed into radius-sized cells so neighbor lookup is local.
  const units: (readonly [number, number] | null)[] = points.map((point, index) => {
    if (!point || exclude.has(index)) return null;
    return [(point.x / 100) * BOARD_WIDTH, (point.y / 100) * BOARD_HEIGHT] as const;
  });
  const cells = new Map<string, number[]>();
  const cellKey = (ux: number, uy: number) =>
    `${Math.floor(ux / radius)}:${Math.floor(uy / radius)}`;
  units.forEach((unit, index) => {
    if (!unit) return;
    const key = cellKey(unit[0], unit[1]);
    const bucket = cells.get(key);
    if (bucket) bucket.push(index);
    else cells.set(key, [index]);
  });

  const grouped = new Set<number>();
  const clusters: FirstPaintCluster[] = [];

  units.forEach((seed, seedIndex) => {
    if (!seed || grouped.has(seedIndex)) return;
    const members: number[] = [];
    const cx = Math.floor(seed[0] / radius);
    const cy = Math.floor(seed[1] / radius);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = cells.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const candidate of bucket) {
          if (grouped.has(candidate)) continue;
          const unit = units[candidate];
          if (!unit) continue;
          const ddx = unit[0] - seed[0];
          const ddy = unit[1] - seed[1];
          if (ddx * ddx + ddy * ddy <= radiusSq) members.push(candidate);
        }
      }
    }
    if (members.length < minPoints) return;
    let sumX = 0;
    let sumY = 0;
    for (const member of members) {
      grouped.add(member);
      const point = points[member];
      if (point) {
        sumX += point.x;
        sumY += point.y;
      }
    }
    clusters.push({
      x: round(sumX / members.length),
      y: round(sumY / members.length),
      count: members.length,
    });
  });

  return { clusters, grouped };
}

/**
 * Size class for a cluster disc, mirroring `CLUSTER_RADIUS_BY_COUNT` (10 / 50 / 200 steps) so
 * the board's discs step up with count the way the plate's do.
 */
export function firstPaintClusterTier(count: number): 1 | 2 | 3 | 4 {
  if (count >= 200) return 4;
  if (count >= 50) return 3;
  if (count >= 10) return 2;
  return 1;
}
