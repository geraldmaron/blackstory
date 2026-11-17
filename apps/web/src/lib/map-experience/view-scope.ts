/**
 * The list follows the map (owner decision 2026-11-16): while the camera is closer than the whole
 * country, the column lists only the records whose point is in view. The map itself keeps drawing
 * every match, so nothing the map shows is missing from the list for the area on screen.
 *
 * Bounds are never written to the URL (`EXPLORE_VIEWPORT_POLICY_DROPPED_KEYS`): this is live
 * camera state, not a shareable view.
 */
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import type { ExploreMapFeature } from './build-explore-map-source';
import type { ExploreMapBounds } from './url-state';

/** True when the view still holds all of the lower 48: the national view, which never narrows. */
export function viewHoldsNation(bounds: ExploreMapBounds): boolean {
  const [west, south, east, north] = US_CONUS_BOUNDS;
  return (
    bounds.west <= west && bounds.south <= south && bounds.east >= east && bounds.north >= north
  );
}

export function featureInView(feature: ExploreMapFeature, bounds: ExploreMapBounds): boolean {
  const [lng, lat] = feature.geometry.coordinates;
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

/** The bounds the list should narrow to, or null when the view is national. */
export function narrowingBounds(bounds: ExploreMapBounds | null): ExploreMapBounds | null {
  return bounds && !viewHoldsNation(bounds) ? bounds : null;
}

export function featuresInView(
  features: readonly ExploreMapFeature[],
  bounds: ExploreMapBounds | null,
): readonly ExploreMapFeature[] {
  const narrow = narrowingBounds(bounds);
  return narrow ? features.filter((feature) => featureInView(feature, narrow)) : features;
}
