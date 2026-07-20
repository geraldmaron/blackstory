/**
 * Builds a shareable `/explore` href from a `/locate` resolution so the locate CTA opens
 * Explore centered on the resolved place with the default 10-mile radius filter — matching
 * Explore's place-search radius behavior without exposing raw coordinates in visible copy.
 */
import { CAMERA_COUNTY_ZOOM } from '../map-experience/camera-presets';
import { DEFAULT_EXPLORE_FILTERS } from '../map-experience/filters';
import type { ExploreRadiusPresetId } from '../map-experience/explore-place-radius';
import { resolveExploreAddressCamera } from '../map-experience/resolve-explore-address-camera';
import { buildExploreHref, defaultExploreOverlayState } from '../map-experience/url-state';
import type { LocateResolution } from './locate-client';

/** Default place-search radius when handing off from `/locate` to `/explore`. */
export const LOCATE_EXPLORE_DEFAULT_RADIUS_ID: ExploreRadiusPresetId = '10mi';

function placeLabelFromResolution(resolution: LocateResolution): string | undefined {
  const parts = [
    resolution.match.placeName,
    resolution.match.countyName,
    resolution.match.stateName,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function finiteCoordinate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Maps a locate resolution to an explore deep link with camera + optional radius. */
export function buildLocateExploreHref(resolution: LocateResolution): string {
  const near = placeLabelFromResolution(resolution);
  const { lat, lng, exactCoordinatesRetained } = resolution.precision;

  if (
    exactCoordinatesRetained &&
    finiteCoordinate(lat) &&
    finiteCoordinate(lng)
  ) {
    return buildExploreHref({
      filters: DEFAULT_EXPLORE_FILTERS,
      ...defaultExploreOverlayState(),
      viewport: { lat, lng, zoom: CAMERA_COUNTY_ZOOM },
      radius: LOCATE_EXPLORE_DEFAULT_RADIUS_ID,
      ...(near ? { near } : {}),
    });
  }

  const target = resolveExploreAddressCamera(resolution);
  if (target) {
    return buildExploreHref({
      filters: DEFAULT_EXPLORE_FILTERS,
      ...defaultExploreOverlayState(),
      viewport: target.viewport,
      ...(near ? { near } : { near: target.label }),
    });
  }

  return '/explore';
}
