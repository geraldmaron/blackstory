/**
 * "Near me" / "near this place" as one lens constraint.
 *
 * A located point (the reader's device, or a geocoded search) narrows the archive the same way a
 * state pick does: it filters what the plate and the rail show (when a radius is chosen), sorts
 * the rail by distance, and names itself as a clearable chip. Pure and Node-testable — no
 * MapLibre, no DOM — so the rules below are exercised directly by `nearby.test.ts`.
 *
 * Privacy: a device position lives only in client state. Nothing here sends it anywhere, and it
 * is never written to the URL.
 */
import type { ExploreMapFeature } from './build-explore-map-source';
import {
  formatExploreDistance,
  mapBoundsForRadius,
  type ExploreGeoPoint,
} from './explore-place-radius';
import type { AreaFrame, LngLat } from './camera-moves';



export type NearbySource = 'device' | 'search';

export type NearbyArea = {
  readonly center: ExploreGeoPoint;
  /** Short place name for chips and announcements ("your location", "Atlanta, Georgia"). */
  readonly label: string;
  readonly source: NearbySource;
  /** Device-reported accuracy radius, when the source is the device. */
  readonly accuracyMeters?: number;
  /** `null` = no radius filter: everything stays, sorted by distance. */
  readonly radiusMeters: number | null;
  /** Spoken radius ("5 miles"), when `radiusMeters` is set. */
  readonly radiusLabel?: string;
};

function pointOf(feature: ExploreMapFeature): ExploreGeoPoint | null {
  if (feature.geometry.type !== 'Point') return null;
  const [lng, lat] = feature.geometry.coordinates;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function haversine(a: ExploreGeoPoint, b: ExploreGeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance in meters from `center` to every mappable feature, keyed by entity id. */
export function nearbyDistances(
  features: readonly ExploreMapFeature[],
  center: ExploreGeoPoint,
): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const feature of features) {
    const point = pointOf(feature);
    if (point) out.set(feature.properties.entityId, haversine(center, point));
  }
  return out;
}

/** Keeps features inside the radius. No radius keeps everything. Unmappable features drop out
 * only when a radius is set — they have no distance to be inside of. */
export function applyNearbyRadius(
  features: readonly ExploreMapFeature[],
  area: NearbyArea | null,
  distances: ReadonlyMap<string, number>,
): readonly ExploreMapFeature[] {
  if (!area || area.radiusMeters === null) return features;
  const radius = area.radiusMeters;
  return features.filter((feature) => {
    const distance = distances.get(feature.properties.entityId);
    return distance !== undefined && distance <= radius;
  });
}

/** Nearest first; features with no point sort last, in their existing order. */
export function sortByDistance(
  features: readonly ExploreMapFeature[],
  distances: ReadonlyMap<string, number>,
): ExploreMapFeature[] {
  return [...features].sort((a, b) => {
    const left = distances.get(a.properties.entityId) ?? Number.POSITIVE_INFINITY;
    const right = distances.get(b.properties.entityId) ?? Number.POSITIVE_INFINITY;
    return left - right;
  });
}

/** The rail's per-row distance text ("0.4 mi", "12 mi"). */
export function distanceLabel(meters: number | undefined): string | null {
  if (meters === undefined) return null;
  return formatExploreDistance(meters).replace(/ away$/, '');
}

/** The clearable chip in the Records header. */
export function nearbyConstraintLabel(area: NearbyArea): string {
  const place = area.source === 'device' ? 'you' : area.label;
  if (area.radiusMeters !== null && area.radiusLabel) {
    return `Within ${area.radiusLabel} of ${place}`;
  }
  return area.source === 'device' ? 'Near you' : `Near ${area.label}`;
}

function boxAround(center: ExploreGeoPoint, halfSpanMeters: number): readonly [LngLat, LngLat] {
  const [west, south, east, north] = mapBoundsForRadius(center, halfSpanMeters);
  return [
    [west, south],
    [east, north],
  ];
}

/** Street level: what MapLibre's own GeolocateControl caps at (`fitBoundsOptions.maxZoom: 15`). */
export const DEVICE_LOCATE_ZOOM = 15;
/** A searched town or address: neighbourhood scale, a few streets either side. */
export const SEARCH_LOCATE_ZOOM = 13;
/** Accuracy worse than this frames the whole uncertainty circle instead of a street view. */
const ACCURACY_FRAME_THRESHOLD_METERS = 150;

/**
 * Where the camera goes once a place is located — the convention every maps app shares:
 *
 * - A radius the reader chose: the whole circle.
 * - The device: centred on you at street level. If the fix is loose (e.g. Wi-Fi/IP-based), the
 *   accuracy circle instead, so the map does not claim a precision it does not have.
 * - A searched place: centred on it at neighbourhood scale.
 *
 * It no longer zooms out to fit "you plus the nearest records": when those were miles away the
 * camera landed at county scale, which read as "near me did not zoom in". The Records list
 * carries the nearest records, sorted by distance, wherever they are.
 */
export function nearbyFrame(area: NearbyArea, _features?: readonly ExploreMapFeature[]): AreaFrame {
  const label =
    area.radiusMeters !== null && area.radiusLabel
      ? `${area.radiusLabel} of ${area.label}`
      : area.label;
  if (area.radiusMeters !== null) {
    return { kind: 'bounds', bounds: boxAround(area.center, area.radiusMeters), label };
  }
  if (area.source === 'device') {
    const accuracy = area.accuracyMeters;
    if (accuracy !== undefined && accuracy > ACCURACY_FRAME_THRESHOLD_METERS) {
      return { kind: 'bounds', bounds: boxAround(area.center, accuracy * 1.1), label };
    }
    return {
      kind: 'center',
      center: [area.center.lng, area.center.lat],
      zoom: DEVICE_LOCATE_ZOOM,
      label,
    };
  }
  return {
    kind: 'center',
    center: [area.center.lng, area.center.lat],
    zoom: SEARCH_LOCATE_ZOOM,
    label,
  };
}

/** Within this, the nearest record is "right here" and needs no distance in the summary. */
const SUMMARY_CLOSE_METERS = 800;

/** One sentence for the toast/status after locating. */
export function nearbySummary(
  area: NearbyArea,
  inRadius: number,
  nearestMeters: number | undefined,
): string {
  const where = area.source === 'device' ? 'you' : area.label;
  if (area.radiusMeters !== null && area.radiusLabel) {
    if (inRadius > 0) {
      return `${inRadius} ${inRadius === 1 ? 'record' : 'records'} within ${area.radiusLabel} of ${where}.`;
    }
    return nearestMeters === undefined
      ? `Nothing documented within ${area.radiusLabel} of ${where} yet.`
      : `Nothing within ${area.radiusLabel} of ${where} yet. The nearest record is ${formatExploreDistance(nearestMeters)}.`;
  }
  if (nearestMeters === undefined) return `Centered on ${where}.`;
  if (nearestMeters > SUMMARY_CLOSE_METERS) {
    return `The nearest record is ${formatExploreDistance(nearestMeters)}. Records are listed nearest first.`;
  }
  return `Showing records nearest ${where}.`;
}
