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
  closestFeatures,
  formatExploreDistance,
  mapBoundsForRadius,
  type ExploreGeoPoint,
} from './explore-place-radius';
import type { AreaFrame, LngLat } from './camera-moves';
import { CAMERA_COUNTY_ZOOM } from './camera-presets';

const METERS_PER_MILE = 1609.344;

/** How far "around you" reaches when framing the nearest records with no radius chosen. */
export const NEARBY_FRAME_REACH_METERS = 25 * METERS_PER_MILE;
/** How many of the nearest records the opening frame tries to include. */
export const NEARBY_FRAME_COUNT = 6;
/** Smallest box the frame will fit, so one record next door does not zoom to street level. */
const MIN_FRAME_HALF_SPAN_METERS = 900;

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

/**
 * Where the camera goes once a place is located.
 *
 * - A radius: the whole circle.
 * - No radius: the located point plus its nearest records, if any sit within reach — so "near
 *   me" lands on records, not on an empty neighbourhood.
 * - Nothing within reach: the point itself at neighbourhood (device) or locality (search) scale.
 */
export function nearbyFrame(
  area: NearbyArea,
  features: readonly ExploreMapFeature[],
): AreaFrame {
  const label =
    area.radiusMeters !== null && area.radiusLabel
      ? `${area.radiusLabel} of ${area.label}`
      : area.label;
  if (area.radiusMeters !== null) {
    return { kind: 'bounds', bounds: boxAround(area.center, area.radiusMeters), label };
  }
  const near = closestFeatures(features, area.center, NEARBY_FRAME_COUNT).filter(
    (entry) => entry.distanceMeters <= NEARBY_FRAME_REACH_METERS,
  );
  if (near.length === 0) {
    return {
      kind: 'center',
      center: [area.center.lng, area.center.lat],
      zoom: area.source === 'device' ? 13.2 : CAMERA_COUNTY_ZOOM,
      label,
    };
  }
  const farthest = Math.max(...near.map((entry) => entry.distanceMeters));
  return {
    kind: 'bounds',
    bounds: boxAround(area.center, Math.max(MIN_FRAME_HALF_SPAN_METERS, farthest * 1.15)),
    label,
  };
}

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
  if (nearestMeters > NEARBY_FRAME_REACH_METERS) {
    return `The nearest record is ${formatExploreDistance(nearestMeters)}. Records are sorted by distance.`;
  }
  return `Showing records nearest ${where}.`;
}
