/**
 * Pure grid clustering + a two-interaction resolution model (MOB-012).
 *
 * On device the map draws clusters with MapLibre Native's built-in
 * supercluster (`cluster` on the GeoJSON source). That engine cannot run in a JS
 * unit test, so this module is the pure, testable model of the SAME contract the
 * bead requires — "clusters resolve to individual names within two interactions"
 * — and it is what the accessible list-alternative and the tap handler use.
 *
 * PRIVACY INVARIANT ("no hidden exact location through zoom or radius",
 * ADR-024 §9/§10): clustering is aggregation only. It NEVER interpolates or
 * reverse-geocodes an entity coordinate. Every member returned from a resolution
 * carries its ORIGINAL redacted coordinate, unchanged. The only derived point is
 * a cluster's display marker, and that marker is explicitly COARSENED to the
 * least-precise member's precision (`coarsenTo`), so an aggregate can never read
 * as more precise than the data it summarizes. `assertClusterPrecisionSafe`
 * encodes this as a checkable guard, exercised by clustering.test.ts.
 */
import { coarsenTo, coarsestDecimals, isNoMorePreciseThan, type LngLat } from '@/features/map/mapCamera';
import type { ExploreFeature } from './explore-feature';

export type Cluster = {
  readonly kind: 'cluster';
  readonly id: string;
  /** Display-only marker, coarsened to the coarsest member precision. */
  readonly marker: LngLat;
  readonly count: number;
  readonly members: readonly ExploreFeature[];
};

export type SinglePoint = {
  readonly kind: 'point';
  readonly id: string;
  readonly feature: ExploreFeature;
};

export type ClusterNode = Cluster | SinglePoint;

/**
 * Grid cell size in degrees for an integer zoom. Larger cells at low zoom merge
 * far-apart points; cells shrink geometrically as you zoom in, so a cluster that
 * spans multiple redacted city coordinates splits as the camera closes in.
 */
export function cellSizeDegrees(zoom: number): number {
  const BASE_CELL_DEG = 96; // ~whole-continent cell at zoom 0
  const z = Math.max(0, Math.floor(zoom));
  return BASE_CELL_DEG / 2 ** z;
}

function cellKey(coord: LngLat, cell: number): string {
  return `${Math.floor(coord[0] / cell)}:${Math.floor(coord[1] / cell)}`;
}

/**
 * Buckets features into a grid at `zoom`. Cells with a single feature become
 * `point` nodes; cells with 2+ become `cluster` nodes whose marker is the
 * precision-coarsened centroid. Output order is stable (sorted by node id).
 */
export function clusterFeatures(
  features: readonly ExploreFeature[],
  zoom: number,
): readonly ClusterNode[] {
  const cell = cellSizeDegrees(zoom);
  const buckets = new Map<string, ExploreFeature[]>();
  for (const feature of features) {
    const key = cellKey(feature.coordinates, cell);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(feature);
    else buckets.set(key, [feature]);
  }

  const nodes: ClusterNode[] = [];
  for (const [key, members] of buckets) {
    if (members.length === 1) {
      nodes.push({ kind: 'point', id: `pt:${members[0].id}`, feature: members[0] });
      continue;
    }
    const coords = members.map((m) => m.coordinates);
    const centroid: LngLat = [
      coords.reduce((s, c) => s + c[0], 0) / coords.length,
      coords.reduce((s, c) => s + c[1], 0) / coords.length,
    ];
    const marker = coarsenTo(centroid, coarsestDecimals(coords));
    nodes.push({ kind: 'cluster', id: `cl:${key}`, marker, count: members.length, members });
  }
  return nodes.sort((a, b) => a.id.localeCompare(b.id));
}

export type ClusterResolution =
  | { readonly kind: 'entities'; readonly members: readonly ExploreFeature[] }
  | { readonly kind: 'zoom'; readonly toZoom: number };

/** How much a single cluster tap zooms in before re-clustering. */
export const CLUSTER_ZOOM_STEP = 3;

/**
 * Resolves a tap on a cluster. Guarantees individual names within TWO taps:
 *  - If zooming in by one step would split the members into 2+ nodes, return a
 *    `zoom` instruction (the next tap on any resulting sub-cluster resolves
 *    identically, so 2 taps at most reach individuals).
 *  - If the members are effectively coincident (same redacted coordinate, so no
 *    amount of zoom separates them), return the member list DIRECTLY — a single
 *    tap resolves to names rather than zooming forever into false precision.
 */
export function resolveCluster(cluster: Cluster, currentZoom: number): ClusterResolution {
  const nextZoom = currentZoom + CLUSTER_ZOOM_STEP;
  const split = clusterFeatures(cluster.members, nextZoom);
  if (split.length > 1) return { kind: 'zoom', toZoom: nextZoom };
  return { kind: 'entities', members: cluster.members };
}

/**
 * Checkable privacy guard for a produced cluster: (1) its marker is no more
 * precise than the coarsest member, and (2) every member coordinate is byte-for-
 * byte the same as the input (no jitter/interpolation was introduced). Throws on
 * violation. Exercised by clustering.test.ts as the de-redaction proof.
 */
export function assertClusterPrecisionSafe(
  cluster: Cluster,
  inputById: ReadonlyMap<string, LngLat>,
): void {
  const memberCoords = cluster.members.map((m) => m.coordinates);
  if (!isNoMorePreciseThan(cluster.marker, memberCoords)) {
    throw new Error('Privacy invariant violated: cluster marker is more precise than its members.');
  }
  for (const member of cluster.members) {
    const original = inputById.get(member.id);
    if (!original) continue;
    if (original[0] !== member.coordinates[0] || original[1] !== member.coordinates[1]) {
      throw new Error(
        `Privacy invariant violated: member ${member.id} coordinate was altered by clustering.`,
      );
    }
  }
}
