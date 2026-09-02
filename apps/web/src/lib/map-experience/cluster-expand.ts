/**
 * Pure helpers for expanding MapLibre GeoJSON clusters on the Explore plate.
 * Cluster taps zoom in until the aggregate splits; they never open a leaf record sheet.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { MAP_MAX_ZOOM } from './camera-presets';

/** Minimum zoom advance when MapLibre cannot resolve an expansion level. */
export const CLUSTER_FALLBACK_ZOOM_STEP = 2;

export type ClusterLngLat = readonly [lng: number, lat: number];

/** Clamp a cluster expansion zoom to the Explore camera envelope. */
export function clampClusterExpansionZoom(expansionZoom: number, currentZoom: number): number {
  const base = Number.isFinite(currentZoom) ? currentZoom : 0;
  const resolved = Number.isFinite(expansionZoom)
    ? expansionZoom
    : base + CLUSTER_FALLBACK_ZOOM_STEP;
  return Math.min(MAP_MAX_ZOOM, Math.max(resolved, base + 0.001));
}

/** Ease duration for cluster drill-in (0 when reduced motion). */
export function clusterExpandDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 420;
}

/** Read a cluster bubble center from a queried MapLibre point feature. */
export function clusterCenterFromCoordinates(
  coordinates: readonly number[] | undefined,
): ClusterLngLat | undefined {
  if (!coordinates || coordinates.length < 2) return undefined;
  const lng = coordinates[0];
  const lat = coordinates[1];
  if (typeof lng !== 'number' || typeof lat !== 'number') return undefined;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  return [lng, lat];
}

/** MapLibre `clusterProperties` counters for dominant kind-family paint. */
export function exploreClusterProperties(): Record<string, ExpressionSpecification> {
  const properties: Record<string, ExpressionSpecification> = {};
  for (const family of ['people', 'places', 'organizations', 'events', 'sources'] as const) {
    properties[`${family}_n`] = [
      '+',
      ['case', ['==', ['get', 'kindFamily'], family], 1, 0],
    ] as unknown as ExpressionSpecification;
  }
  return properties;
}
