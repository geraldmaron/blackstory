/**
 * Fail-closed publish gate for entity locations: blocks release when a declared state code does
 * not contain the stored coordinates. Mirrors `../facts/publish-gate.ts` aggregate-then-report
 * shape; intended caller is the projection/release pipeline before manifest activation.
 */

import { auditEntityStateContainment } from './audit.js';
import type {
  EntityLocationAuditRow,
  GeoIntegrityPublishGateFailure,
  GeoIntegrityPublishGateResult,
  StateBoundaryIndex,
} from './types.js';
import type { GeoIntegrityAuditOptions } from './audit.js';

function mismatchMessage(mismatch: {
  id: string;
  declaredStateCode: string;
  lat: number;
  lng: number;
  reason: string;
  inferredStateCode?: string;
}): string {
  const coords = `(${mismatch.lat}, ${mismatch.lng})`;
  switch (mismatch.reason) {
    case 'point_not_in_declared_state':
      return mismatch.inferredStateCode
        ? `Entity "${mismatch.id}" declares ${mismatch.declaredStateCode} but ${coords} lies in ${mismatch.inferredStateCode}.`
        : `Entity "${mismatch.id}" declares ${mismatch.declaredStateCode} but ${coords} is outside that boundary.`;
    case 'missing_boundary':
      return `Entity "${mismatch.id}" declares ${mismatch.declaredStateCode} but no boundary polygon is loaded for that state.`;
    case 'unknown_state_code':
      return `Entity "${mismatch.id}" has an empty or unknown state code at ${coords}.`;
    default:
      return `Entity "${mismatch.id}" failed geo-integrity at ${coords}.`;
  }
}

export function evaluateGeoIntegrityPublishGate(
  rows: readonly EntityLocationAuditRow[],
  boundaries: StateBoundaryIndex,
  options: GeoIntegrityAuditOptions = {},
): GeoIntegrityPublishGateResult {
  const audit = auditEntityStateContainment(rows, boundaries, options);
  if (audit.ok) return { ok: true };

  const failures: GeoIntegrityPublishGateFailure[] = audit.mismatches.map((m) => ({
    id: m.id,
    reason: m.reason,
    message: mismatchMessage(m),
  }));
  return { ok: false, failures };
}

export function assertGeoIntegrityPublishGate(
  rows: readonly EntityLocationAuditRow[],
  boundaries: StateBoundaryIndex,
  options: GeoIntegrityAuditOptions = {},
): void {
  const result = evaluateGeoIntegrityPublishGate(rows, boundaries, options);
  if (!result.ok) {
    const detail = result.failures.map((f) => f.message).join(' ');
    throw new Error(
      `Release blocked: geo-integrity publish gate failed for ${result.failures.length} location(s). ${detail}`,
    );
  }
}
