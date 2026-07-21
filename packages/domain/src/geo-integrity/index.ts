/**
 * Geo-integrity surface: point-in-polygon containment, batch audit, and fail-closed publish gate
 * for declared U.S. state codes vs WGS84 coordinates.
 */
export type {
  GeoPoint,
  GeoRing,
  StateBoundary,
  StateBoundaryIndex,
  EntityLocationAuditRow,
  GeoIntegrityMismatchReason,
  GeoIntegrityMismatch,
  GeoIntegrityAuditResult,
  GeoIntegrityPublishGateFailure,
  GeoIntegrityPublishGateResult,
} from './types.js';

export {
  DEFAULT_CONTAINMENT_TOLERANCE_DEGREES,
  pointInRing,
  pointInPolygonRings,
} from './point-in-polygon.js';

export {
  normalizeStateCode,
  buildStateBoundaryIndex,
  pointContainedInDeclaredState,
  evaluateStateContainment,
  findContainingStateCode,
} from './containment.js';
export type { StateContainmentResult } from './containment.js';

export { auditEntityStateContainment } from './audit.js';
export type { GeoIntegrityAuditOptions } from './audit.js';

export {
  evaluateGeoIntegrityPublishGate,
  assertGeoIntegrityPublishGate,
} from './publish-gate.js';

export {
  FIXTURE_POINT_BOSTON_MA,
  FIXTURE_POINT_HARLEM_NY,
  FIXTURE_STATE_BOUNDARIES,
  FIXTURE_STATE_JURISDICTION_ROWS,
} from './fixtures.js';
