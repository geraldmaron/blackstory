/**
 * BB-077 UGC compliance and living-person ethics layer: per-source obligations registry,
 * evidence-pointer doctrine, deletion-sync framework, living-person UGC guards, and
 * takedown-request routing. Extends BB-016 provenance/rights (../provenance/index.js) rather
 * than replacing it — see each module's header for the specific BB-016/BB-037 pattern mirrored.
 */
export {
  OBLIGATION_SOURCE_CLASSES,
  createInMemoryObligationsRegistry,
  registerSourceObligations,
  hasSourceObligationsEntry,
  getSourceObligationsOrThrow,
  assertAdapterHasObligations,
  defaultSourceObligationsSeed,
} from './obligations.js';
export type {
  ObligationSourceClass,
  DeletionSyncObligation,
  SourceObligations,
  ObligationsRegistryStore,
} from './obligations.js';

export {
  MAX_EVIDENCE_SNIPPET_CHARACTERS,
  MAX_EVIDENCE_SNIPPET_WORDS,
  assertNoFullPageFields,
  assertEvidencePointerValid,
  buildEvidencePointer,
} from './evidence-pointer.js';
export type { EvidencePointer, EvidencePointerRetrievalMetadata } from './evidence-pointer.js';

export {
  DELETION_SYNC_CASCADE_KINDS,
  planDeletionSyncPurge,
  applyDeletionSyncPurge,
} from './deletion-sync.js';
export type {
  DeletionSyncCascadeKind,
  DeletionSyncCascadeTarget,
  DeletionSyncRequest,
  DeletionSyncMutation,
  DeletionSyncRecord,
  DeletionSyncPlan,
  PurgeableStore,
} from './deletion-sync.js';

export {
  assertNoCrossSourceProfileAggregation,
  assertUgcLivingPersonClaimMayAdvance,
  assertNoDeanonymization,
} from './living-person-ugc.js';
export type {
  PersonalDetailContribution,
  UgcLivingPersonClaimInput,
  DeanonymizationAttempt,
} from './living-person-ugc.js';

export {
  TAKEDOWN_REASONS,
  TAKEDOWN_DISTINCT_TAG,
  TAKEDOWN_BRIDGE_SUBMISSION_KIND,
  TAKEDOWN_ACKNOWLEDGEMENT_SLA_HOURS,
  TAKEDOWN_RESOLUTION_SLA_DAYS,
  assertTakedownReasonValid,
  buildTakedownRequestRecord,
} from './takedown.js';
export type {
  TakedownReason,
  TakedownRequestInput,
  TakedownRequestSla,
  TakedownRequestRecord,
} from './takedown.js';
