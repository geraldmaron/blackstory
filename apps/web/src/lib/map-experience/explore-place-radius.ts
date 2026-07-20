/**
 * Place-search radius presets and pure geography helpers for `/explore`.
 *
 * After a geocode fly-to, optional finite radii decide which documented points fall inside
 * the chosen circle and, when none do, which nearest records to introduce. `"all"` means no
 * circle filter — fly to the place, keep the full map catalog visible. Distance math uses
 * domain `haversineMeters`.
 */
import { haversineMeters } from '@repo/domain/geography/geohash';
import type { ExploreMapFeature } from './build-explore-map-source';

const METERS_PER_MILE = 1609.344;

export type ExploreRadiusPresetId = 'all' | '5mi' | '10mi' | '25mi' | '50mi';

export type ExploreRadiusPreset = {
  readonly id: ExploreRadiusPresetId;
  /** Short chip label (e.g. All, 5 mi). */
  readonly label: string;
  /** Spoken / status label (e.g. “5 miles”). */
  readonly statusLabel: string;
  /** `null` = unlimited (no circle filter). */
  readonly meters: number | null;
};

/** Standard search radii — All first; miles for US place framing. */
export const EXPLORE_RADIUS_PRESETS: readonly ExploreRadiusPreset[] = [
  { id: 'all', label: 'All', statusLabel: 'any distance', meters: null },
  { id: '5mi', label: '5 mi', statusLabel: '5 miles', meters: Math.round(5 * METERS_PER_MILE) },
  { id: '10mi', label: '10 mi', statusLabel: '10 miles', meters: Math.round(10 * METERS_PER_MILE) },
  { id: '25mi', label: '25 mi', statusLabel: '25 miles', meters: Math.round(25 * METERS_PER_MILE) },
  { id: '50mi', label: '50 mi', statusLabel: '50 miles', meters: Math.round(50 * METERS_PER_MILE) },
] as const;

export const DEFAULT_EXPLORE_RADIUS_ID: ExploreRadiusPresetId = 'all';

export function exploreRadiusPresetById(id: string): ExploreRadiusPreset {
  return (
    EXPLORE_RADIUS_PRESETS.find((preset) => preset.id === id) ??
    EXPLORE_RADIUS_PRESETS.find((preset) => preset.id === DEFAULT_EXPLORE_RADIUS_ID)!
  );
}

export function isUnlimitedRadius(preset: ExploreRadiusPreset): boolean {
  return preset.meters === null;
}

export type ExploreGeoPoint = {
  readonly lat: number;
  readonly lng: number;
};

export type ExploreNearbyFeature = {
  readonly feature: ExploreMapFeature;
  readonly distanceMeters: number;
};

function pointForFeature(feature: ExploreMapFeature): ExploreGeoPoint | null {
  if (feature.geometry.type !== 'Point') return null;
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Features whose point falls within `radiusMeters` of `center`, nearest first. */
export function featuresWithinRadius(
  features: readonly ExploreMapFeature[],
  center: ExploreGeoPoint,
  radiusMeters: number,
): readonly ExploreNearbyFeature[] {
  const radius = Math.max(0, radiusMeters);
  const out: ExploreNearbyFeature[] = [];
  for (const feature of features) {
    const point = pointForFeature(feature);
    if (!point) continue;
    const distanceMeters = haversineMeters(center, point);
    if (distanceMeters <= radius) {
      out.push({ feature, distanceMeters });
    }
  }
  out.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return out;
}

/** Nearest documented points to `center`, regardless of radius (for empty-radius intros). */
export function closestFeatures(
  features: readonly ExploreMapFeature[],
  center: ExploreGeoPoint,
  limit = 3,
): readonly ExploreNearbyFeature[] {
  const capped = Math.max(0, Math.floor(limit));
  if (capped === 0) return [];
  const ranked: ExploreNearbyFeature[] = [];
  for (const feature of features) {
    const point = pointForFeature(feature);
    if (!point) continue;
    ranked.push({ feature, distanceMeters: haversineMeters(center, point) });
  }
  ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return ranked.slice(0, capped);
}

/** MapLibre `fitBounds` tuple [west, south, east, north] covering a search circle. */
export function mapBoundsForRadius(
  center: ExploreGeoPoint,
  radiusMeters: number,
): readonly [west: number, south: number, east: number, north: number] {
  const radius = Math.max(100, radiusMeters);
  const latDelta = radius / 111_320;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const lngDelta = radius / (111_320 * Math.max(0.2, Math.abs(cosLat)));
  return [
    center.lng - lngDelta,
    center.lat - latDelta,
    center.lng + lngDelta,
    center.lat + latDelta,
  ];
}

/** Human distance for closest-record intros — miles when ≥ 0.1 mi, else meters. */
export function formatExploreDistance(meters: number): string {
  const safe = Math.max(0, meters);
  if (safe >= METERS_PER_MILE * 0.1) {
    const miles = safe / METERS_PER_MILE;
    const rounded = miles >= 10 ? Math.round(miles) : Math.round(miles * 10) / 10;
    return `${rounded} mi away`;
  }
  if (safe >= 100) {
    return `${Math.round(safe)} m away`;
  }
  return 'nearby';
}

export function emptyRadiusStatusMessage(options: {
  readonly placeLabel: string;
  readonly radiusLabel: string;
}): string {
  return `Nothing documented within ${options.radiusLabel} of ${options.placeLabel} yet. Closest records:`;
}

export function matchesRadiusStatusMessage(options: {
  readonly count: number;
  readonly placeLabel: string;
  readonly radiusLabel: string;
}): string {
  const noun = options.count === 1 ? 'record' : 'records';
  return `${options.count} documented ${noun} within ${options.radiusLabel} of ${options.placeLabel}.`;
}

export function placeOnlyStatusMessage(placeLabel: string): string {
  return `Centered on ${placeLabel}. All documented records stay on the map.`;
}
