/**
 * Pure helpers for expanding the Explore map camera when a MapLibre cluster
 * bubble is pressed. Kept separate from MapScreen so zoom-step + clamp behavior
 * is unit-testable without mounting the native GL view.
 */
import { clampZoom, type LngLat } from './mapCamera';

/** How many zoom levels a cluster tap advances (clamped to MAP_MAX_ZOOM). */
export const CLUSTER_CAMERA_ZOOM_STEP = 2;

/** True when a pressed GeoJSON feature is a MapLibre cluster bubble (not a leaf). */
export function isClusterFeatureProperties(props: Record<string, unknown>): boolean {
  if (typeof props.point_count === 'number' && Number.isFinite(props.point_count)) return true;
  if (props.cluster === true) return true;
  return false;
}

/** Resolves a Point feature's center, or null when geometry is missing/invalid. */
export function clusterCenterFromFeature(feature: GeoJSON.Feature): LngLat | null {
  const geometry = feature.geometry;
  if (!geometry || geometry.type !== 'Point') return null;
  const [lng, lat] = geometry.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

/**
 * Next zoom after a cluster expand: current + step, never above the privacy
 * ceiling and never NaN.
 */
export function zoomAfterClusterExpand(currentZoom: number): number {
  const base = Number.isFinite(currentZoom) ? currentZoom : 0;
  return clampZoom(base + CLUSTER_CAMERA_ZOOM_STEP);
}
