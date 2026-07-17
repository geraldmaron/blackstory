/**
 * Citation integrity and link-rot management surface (BB-083).
 */
export {
  OFFLINE_SOURCE_KINDS,
  LINK_HEALTH_STATUSES,
  assertOfflineSourceDesignationValid,
  assertCitationLocationValid,
  assertCitationCapturePointerValid,
  assertCitationStructurallyComplete,
  isCitationStructurallyComplete,
  buildCitationFromEvidence,
} from './citation.js';
export type {
  OfflineSourceKind,
  OfflineSourceDesignation,
  CitationLocation,
  CitationCapturePointer,
  LinkHealthStatus,
  Citation,
} from './citation.js';

export {
  evaluateClaimCitationCompleteness,
  assertClaimCitationComplete,
  evaluateProjectionCitationCompleteness,
  assertProjectionCitationCompletenessGate,
} from './completeness-gate.js';
export type { CitationCompletenessFailure, CitationCompletenessResult } from './completeness-gate.js';

export {
  DEFAULT_DRIFT_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
  compareCapturedContent,
} from './drift-detection.js';
export type { ContentDriftResult } from './drift-detection.js';

export {
  DEAD_LINK_REASONS,
  DEFAULT_MAX_RETRIES_BEFORE_DEAD,
  classifyLinkCheckAttempt,
  advanceLinkHealthState,
  initialLinkHealthState,
  contentHashFromHex,
} from './link-health.js';
export type {
  DeadLinkReason,
  LinkCheckFetchResult,
  LinkCheckClassification,
  LinkHealthState,
} from './link-health.js';

export { buildSpnSaveUrl, interpretSpnFetchResult } from './spn-client.js';
export type { SpnFetchResult, SpnCaptureOutcome } from './spn-client.js';

export {
  REPAIR_LADDER_STEPS,
  decideRepairLadderStep,
  applyRepairLadder,
} from './repair-ladder.js';
export type { RepairLadderStep, RepairLadderDecisionInput, RepairLadderOutcome } from './repair-ladder.js';

export { buildTrySearchingForSubject, buildTrySearchingForSuggestion } from './try-searching-for.js';
export type { TrySearchingForCitationInput } from './try-searching-for.js';

export { computeRotRateBySourceClass } from './rot-telemetry.js';
export type { SourceClassRotRate } from './rot-telemetry.js';
