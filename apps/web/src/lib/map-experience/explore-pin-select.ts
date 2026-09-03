/**
 * Explore pin clicks: first-paint discs use opaque `pin-N` ids, so geography
 * (lng/lat on the disc) matches the catalog entity once it arrives. The locator
 * underlay emits a select; the Explore sheet subscribes.
 */

import type { ExploreMapFeature } from './build-explore-map-source';

/** Movement below this is a pin select, not a map pan. */
export const EXPLORE_PIN_CLICK_SLOP_PX = 8;

/** Degrees; about a metre, enough to survive attribute string round-trip. */
const POINT_MATCH_EPSILON = 1e-5;

export type ExplorePinSelectTarget = {
  readonly pinId: string;
  readonly lng?: number;
  readonly lat?: number;
};

type ExplorePinSelectListener = (target: ExplorePinSelectTarget) => void;

const listeners = new Set<ExplorePinSelectListener>();

export function pointerExceededClickSlop(
  startX: number,
  startY: number,
  x: number,
  y: number,
  slopPx = EXPLORE_PIN_CLICK_SLOP_PX,
): boolean {
  return Math.hypot(x - startX, y - startY) > slopPx;
}

export function readExplorePinTarget(target: EventTarget | null): ExplorePinSelectTarget | null {
  if (!(target instanceof Element)) return null;
  const pin = target.closest('[data-entity-id]');
  if (!pin || !pin.closest('.ds-explore-underlay')) return null;
  const pinId = pin.getAttribute('data-entity-id');
  if (!pinId) return null;
  const lng = Number(pin.getAttribute('data-lng'));
  const lat = Number(pin.getAttribute('data-lat'));
  return {
    pinId,
    ...(Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : {}),
  };
}

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
