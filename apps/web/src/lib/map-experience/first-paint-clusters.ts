/**
 * Server-side clustering for Explore's first-paint board — MapLibre's own algorithm and
 * parameters, so the board's copper count discs ARE the plate's clusters, not an imitation.
 *
 * MapLibre clusters a GeoJSON source in its worker with `supercluster` (`geojson_source.ts`:
 * `extent: EXTENT` (8192), `radius: clusterRadius × EXTENT / tileSize`, `minPoints`,
 * `maxZoom: clusterMaxZoom`, `log: false`) and draws, at any camera zoom, the clusters of the
 * integer tile zoom below it. The board runs the same library with the same numbers over the same
 * pin collection the plate opens on (`firstPaintCatalog`), at the tile zooms the plate's opening
 * frame can land in, so every disc — position, count and membership — is the disc the plate will
 * paint at the handoff (repo-27uao). Before this the board grouped greedily by index within a
 * scaled radius, which put a different pattern of discs on screen from the plate's on every load.
 */
import Supercluster, { type PointFeature } from 'supercluster';
import { EXPLORE_CLUSTER_CONFIG } from './dignity-style';

/** MapLibre's vector-tile extent, and the tile size its `clusterRadius` is authored against. */
const MAPLIBRE_TILE_EXTENT = 8192;
const MAPLIBRE_TILE_SIZE = 512;

/** `clusterRadius` in tile units, exactly as `GeoJSONSource._pixelsToTileUnits` scales it. */
export const FIRST_PAINT_CLUSTER_RADIUS_TILE_UNITS =
  (EXPLORE_CLUSTER_CONFIG.clusterRadius * MAPLIBRE_TILE_EXTENT) / MAPLIBRE_TILE_SIZE;

/** Same floor as `EXPLORE_CLUSTER_CONFIG.clusterMinPoints`. */
export const FIRST_PAINT_CLUSTER_MIN_POINTS = EXPLORE_CLUSTER_CONFIG.clusterMinPoints;

/**
 * The tile zooms the plate's opening frame lands in. The constructor fits CONUS to the canvas
 * (`PLATE_OPENING_PADDING_PX`), which is zoom 3.x on a laptop and clamps to the national floor on
 * a phone; from roughly 1400×800 the fit crosses 4. The board carries both patterns and
 * explore-map-underlay.css shows the one the viewport is in.
 */
export const FIRST_PAINT_CLUSTER_ZOOMS = [3, 4] as const;
export type FirstPaintClusterZoom = (typeof FIRST_PAINT_CLUSTER_ZOOMS)[number];

export type FirstPaintPoint = { readonly lng: number; readonly lat: number };

export type FirstPaintCluster = {
  readonly lng: number;
  readonly lat: number;
  readonly count: number;
};

export type FirstPaintGrouping = {
  readonly clusters: readonly FirstPaintCluster[];
  /** Indexes (into the input) of every pin folded into a cluster. */
  readonly grouped: ReadonlySet<number>;
};

type PinProperties = { readonly pinIndex: number };

const WHOLE_WORLD: [number, number, number, number] = [-180, -85, 180, 85];

/**
 * Clusters `points` the way the plate does at tile zoom `zoom`. `null` entries (unprojected
 * pins) are never grouped. Deterministic for a given input order, like the plate's worker.
 */
export function groupFirstPaintPins(
  points: readonly (FirstPaintPoint | null)[],
  zoom: number,
): FirstPaintGrouping {
  const index = new Supercluster<PinProperties, PinProperties>({
    radius: FIRST_PAINT_CLUSTER_RADIUS_TILE_UNITS,
    extent: MAPLIBRE_TILE_EXTENT,
    maxZoom: EXPLORE_CLUSTER_CONFIG.clusterMaxZoom,
    minPoints: FIRST_PAINT_CLUSTER_MIN_POINTS,
    log: false,
  });
  const features: PointFeature<PinProperties>[] = [];
  points.forEach((point, pinIndex) => {
    if (!point) return;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: { pinIndex },
    });
  });
  index.load(features);

  const clusters: FirstPaintCluster[] = [];
  const singles = new Set<number>();
  for (const feature of index.getClusters(WHOLE_WORLD, zoom)) {
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    if ('cluster' in feature.properties && feature.properties.cluster) {
      clusters.push({ lng, lat, count: feature.properties.point_count });
    } else {
      singles.add((feature.properties as PinProperties).pinIndex);
    }
  }
  const grouped = new Set<number>();
  points.forEach((point, pinIndex) => {
    if (point && !singles.has(pinIndex)) grouped.add(pinIndex);
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
