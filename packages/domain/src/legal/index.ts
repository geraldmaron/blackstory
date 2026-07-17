/**
 * BB-087 legal landscape module public surface. NOT yet re-exported from
 * `packages/domain/src/index.ts` (parent-merge file) — import from
 * `../legal/index.js` directly until the parent merges the barrel export.
 */
export {
  LEGAL_LICENSE_TAGS,
  LEGAL_SNAPSHOT_KINDS,
  LEGAL_TOPICS,
  isLegalLicenseTag,
  isLegalSnapshotKind,
  isLegalTopic,
  assertLegalArchiveEvidenceValid,
  assertLegalSnapshotValid,
} from './types.js';
export type {
  LegalLicenseTag,
  LegalSnapshotKind,
  LegalTopic,
  LegalArchiveEvidence,
  LegalCitationFields,
  LegalExternalId,
  LegalSnapshot,
} from './types.js';

export {
  REVIEW_QUEUE_EVENT_TYPES,
  REVIEW_QUEUE_STATUSES,
  REVIEW_QUEUE_CONFIDENCE_LEVELS,
  reviewQueueDedupeKey,
  assertReviewQueueEvidenceValid,
  assertLegalReviewQueueEventValid,
  dedupeReviewQueueEvents,
} from './review-queue.js';
export type {
  ReviewQueueEventType,
  ReviewQueueStatus,
  ReviewQueueConfidence,
  ReviewQueueEvidence,
  LegalReviewQueueEvent,
} from './review-queue.js';

export {
  assertLegalPlainLanguageExplainerValid,
  assertLegalCatalogEntryValid,
} from './explainer.js';
export type {
  LegalTermOfArtLink,
  LegalRightsBullet,
  LegalPrimarySourceLink,
  LegalPlainLanguageExplainer,
  LegalCatalogEntry,
} from './explainer.js';

export {
  LAW_STATUSES,
  LAW_STATUS_LABELS,
  LAW_STATUS_DESCRIPTIONS,
  isLawStatus,
  lawStatusLabel,
  lawStatusDescription,
  lawStatusTone,
} from './status.js';
export type { LawStatus, LawStatusTone } from './status.js';

export {
  proposeLegalReviewEvents,
  snapshotsToMonitoringRows,
} from './monitoring.js';
export type {
  LegalMonitoringSourceSnapshot,
  LegalMonitoringPriorState,
  ProposeLegalReviewEventsInput,
} from './monitoring.js';
