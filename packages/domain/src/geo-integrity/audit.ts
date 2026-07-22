/**
 * Batch audit API for entity locations: given declared state codes and coordinates, return
 * mismatches only. Never mutates or rewrites input rows.
 */

import { evaluateStateContainment } from './containment.js';
import { DEFAULT_CONTAINMENT_TOLERANCE_DEGREES } from './point-in-polygon.js';
import type {
  EntityLocationAuditRow,
  GeoIntegrityAuditResult,
  GeoIntegrityMismatch,
  StateBoundaryIndex,
} from './types.js';

export type GeoIntegrityAuditOptions = {
  readonly toleranceDegrees?: number;
};

/**
 * Audits every row against the supplied boundary index. Rows with empty `stateCode` are
 * treated as unknown and reported as mismatches.
 */
export function auditEntityStateContainment(
  rows: readonly EntityLocationAuditRow[],
  boundaries: StateBoundaryIndex,
  options: GeoIntegrityAuditOptions = {},
): GeoIntegrityAuditResult {
  const tolerance = options.toleranceDegrees ?? DEFAULT_CONTAINMENT_TOLERANCE_DEGREES;
  const mismatches: GeoIntegrityMismatch[] = [];

  for (const row of rows) {
    const result = evaluateStateContainment(
      { lat: row.lat, lng: row.lng },
      row.stateCode,
      boundaries,
      tolerance,
    );
    if (result.ok) continue;

    mismatches.push({
      id: row.id,
      declaredStateCode: row.stateCode,
      lat: row.lat,
      lng: row.lng,
      reason: result.reason,
      ...(result.inferredStateCode ? { inferredStateCode: result.inferredStateCode } : {}),
    });
  }

  if (mismatches.length === 0) {
    return { ok: true, checked: rows.length };
  }
  return { ok: false, checked: rows.length, mismatches };
}
