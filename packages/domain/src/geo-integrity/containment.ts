/**
 * State containment checks: given a declared USPS postal code and a WGS84 point, verify the
 * point lies inside the reference boundary. Fail-closed when the code is unknown or the point
 * is outside the declared state's polygon.
 */

import { pointInPolygonRings, DEFAULT_CONTAINMENT_TOLERANCE_DEGREES } from './point-in-polygon.js';
import type { GeoPoint, StateBoundary, StateBoundaryIndex } from './types.js';

export function normalizeStateCode(stateCode: string): string {
  return stateCode.trim().toUpperCase();
}

export function buildStateBoundaryIndex(
  boundaries: readonly StateBoundary[],
): StateBoundaryIndex {
  const index = new Map<string, StateBoundary>();
  for (const boundary of boundaries) {
    index.set(normalizeStateCode(boundary.stateCode), boundary);
  }
  return index;
}

export type StateContainmentResult =
  | { readonly ok: true; readonly stateCode: string }
  | {
      readonly ok: false;
      readonly stateCode: string;
      readonly reason: 'unknown_state_code' | 'missing_boundary' | 'point_not_in_declared_state';
      readonly inferredStateCode?: string;
    };

/**
 * Returns true when `point` lies inside the boundary for `declaredStateCode`. Unknown codes and
 * missing boundaries fail closed (return false).
 */
export function pointContainedInDeclaredState(
  point: GeoPoint,
  declaredStateCode: string,
  boundaries: StateBoundaryIndex,
  tolerance = DEFAULT_CONTAINMENT_TOLERANCE_DEGREES,
): boolean {
  return isStateContainmentOk(point, declaredStateCode, boundaries, tolerance).ok;
}

/**
 * Evaluates containment and, on failure, optionally reports which other loaded state (if any)
 * would contain the point — for audit only, never for auto-rewrite.
 */
export function evaluateStateContainment(
  point: GeoPoint,
  declaredStateCode: string,
  boundaries: StateBoundaryIndex,
  tolerance = DEFAULT_CONTAINMENT_TOLERANCE_DEGREES,
): StateContainmentResult {
  const normalized = normalizeStateCode(declaredStateCode);
  if (!normalized) {
    return { ok: false, stateCode: declaredStateCode, reason: 'unknown_state_code' };
  }

  const boundary = boundaries.get(normalized);
  if (!boundary) {
    return { ok: false, stateCode: normalized, reason: 'missing_boundary' };
  }

  if (pointInPolygonRings(point, boundary.rings, tolerance)) {
    return { ok: true, stateCode: normalized };
  }

  let inferredStateCode: string | undefined;
  for (const [code, candidate] of boundaries) {
    if (code === normalized) continue;
    if (pointInPolygonRings(point, candidate.rings, tolerance)) {
      inferredStateCode = code;
      break;
    }
  }

  return {
    ok: false,
    stateCode: normalized,
    reason: 'point_not_in_declared_state',
    ...(inferredStateCode ? { inferredStateCode } : {}),
  };
}

function isStateContainmentOk(
  point: GeoPoint,
  declaredStateCode: string,
  boundaries: StateBoundaryIndex,
  tolerance: number,
): StateContainmentResult {
  return evaluateStateContainment(point, declaredStateCode, boundaries, tolerance);
}

/** Finds the first loaded state whose polygon contains the point, if any. */
export function findContainingStateCode(
  point: GeoPoint,
  boundaries: StateBoundaryIndex,
  tolerance = DEFAULT_CONTAINMENT_TOLERANCE_DEGREES,
): string | undefined {
  for (const [code, boundary] of boundaries) {
    if (pointInPolygonRings(point, boundary.rings, tolerance)) {
      return code;
    }
  }
  return undefined;
}
