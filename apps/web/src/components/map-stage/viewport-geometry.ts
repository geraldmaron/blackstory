import type { LngLatLike, Map as MapLibreMap } from 'maplibre-gl';
import type { ExploreViewportFrame } from '../../lib/map-experience/url-state';

/** Normalizes `maplibre-gl`'s `LngLatLike` union (a `LngLat` instance, a `{lng,lat}` or
 * `{lon,lat}` object literal, or a `[lng, lat]` tuple) to a plain tuple. `cameraForBounds`
 * types its result this loosely even though the runtime value is always a `LngLat` instance. */
export function lngLatTuple(value: LngLatLike): [number, number] {
  if (Array.isArray(value)) return [value[0], value[1]];
  if ('lng' in value) return [value.lng, value.lat];
  return [value.lon, value.lat];
}
export function readViewport(map: MapLibreMap): ExploreViewportFrame {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    lat: center.lat,
    lng: center.lng,
    zoom: map.getZoom(),
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
  };
}
