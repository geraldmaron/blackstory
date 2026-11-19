/**
 * Explore pin hand-offs: first-paint pins use opaque `pin-N` ids, so geography
 * (lng/lat on the pin) matches the catalog entity once it arrives. The home hand-off
 * emits a select; the Explore column subscribes.
 */

import type { ExploreMapFeature } from './build-explore-map-source';

/** Degrees; about a meter, enough to survive attribute string round-trip. */
const POINT_MATCH_EPSILON = 1e-5;

export type ExplorePinSelectTarget = {
  readonly pinId: string;
  readonly lng?: number;
  readonly lat?: number;
};

type ExplorePinSelectListener = (target: ExplorePinSelectTarget) => void;

const listeners = new Set<ExplorePinSelectListener>();

export function subscribeExplorePinSelect(listener: ExplorePinSelectListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitExplorePinSelect(target: ExplorePinSelectTarget): void {
  for (const listener of listeners) listener(target);
}

function samePoint(a: number, b: number): boolean {
  return Math.abs(a - b) < POINT_MATCH_EPSILON;
}

/**
 * `pin-N` matches while first-paint is the live catalog. After `/atlas/catalog`
 * lands, match the disc's public coordinates to a release feature.
 */
export function resolveExplorePinEntityId(
  target: ExplorePinSelectTarget,
  features: readonly ExploreMapFeature[],
): string | undefined {
  if (features.some((feature) => feature.properties.entityId === target.pinId)) {
    return target.pinId;
  }
  if (target.lng === undefined || target.lat === undefined) return undefined;
  const pinLng = target.lng;
  const pinLat = target.lat;
  const matches = features.filter((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return samePoint(lng, pinLng) && samePoint(lat, pinLat);
  });
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0]?.properties.entityId;
  const walk = matches.find((feature) => feature.properties.holdingWalk === true);
  return (walk ?? matches[0])?.properties.entityId;
}

/**
 * Resolves a group of pins (the Door's overlap hand-off) together. Resolving each pin alone picks
 * the first record at a shared coordinate for every pin, so two co-located pins collapse into one
 * record; here every record at each pin's coordinate is kept, once, so the chooser loses nothing.
 */
export function resolveExplorePinEntityIds(
  targets: readonly ExplorePinSelectTarget[],
  features: readonly ExploreMapFeature[],
): string[] {
  const ids = new Set<string>();
  for (const target of targets) {
    if (features.some((feature) => feature.properties.entityId === target.pinId)) {
      ids.add(target.pinId);
      continue;
    }
    if (target.lng === undefined || target.lat === undefined) continue;
    for (const feature of features) {
      const [lng, lat] = feature.geometry.coordinates;
      if (samePoint(lng, target.lng) && samePoint(lat, target.lat)) {
        ids.add(feature.properties.entityId);
      }
    }
  }
  return [...ids];
}
