/**
 * Pure point-in-polygon helpers for WGS84 coordinates. Ray casting with a small boundary
 * tolerance so near-edge floating-point jitter does not false-fail containment checks.
 */

import type { GeoPoint, GeoRing } from './types.js';

/** ~5 m at mid-latitude; small enough for integrity, large enough for float noise. */
export const DEFAULT_CONTAINMENT_TOLERANCE_DEGREES = 0.00005;

function ringBBox(ring: GeoRing): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

function pointInRingBBox(
  point: GeoPoint,
  ring: GeoRing,
  tolerance: number,
): boolean {
  const { minLng, maxLng, minLat, maxLat } = ringBBox(ring);
  return (
    point.lng >= minLng - tolerance &&
    point.lng <= maxLng + tolerance &&
    point.lat >= minLat - tolerance &&
    point.lat <= maxLat + tolerance
  );
}

/**
 * Ray-casting point-in-polygon for a single ring. Returns true when the point lies inside
 * the ring or within `tolerance` degrees of an edge (boundary-inclusive for integrity).
 */
export function pointInRing(
  point: GeoPoint,
  ring: GeoRing,
  tolerance = DEFAULT_CONTAINMENT_TOLERANCE_DEGREES,
): boolean {
  if (ring.length < 4) return false;
  if (!pointInRingBBox(point, ring, tolerance)) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0) + xi;
    if (intersects) inside = !inside;
  }
  if (inside) return true;

  return minDistanceToRingEdges(point, ring) <= tolerance;
}

function minDistanceToRingEdges(point: GeoPoint, ring: GeoRing): number {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [x1, y1] = ring[j]!;
    const [x2, y2] = ring[i]!;
    const dist = pointToSegmentDistance(point.lng, point.lat, x1, y1, x2, y2);
    if (dist < min) min = dist;
  }
  return min;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/** True when the point lies inside the exterior ring of a polygon (holes ignored). */
export function pointInPolygonRings(
  point: GeoPoint,
  rings: readonly GeoRing[],
  tolerance = DEFAULT_CONTAINMENT_TOLERANCE_DEGREES,
): boolean {
  const exterior = rings[0];
  if (!exterior) return false;
  return pointInRing(point, exterior, tolerance);
}
