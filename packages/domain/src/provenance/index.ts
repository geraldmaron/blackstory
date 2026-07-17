/**
 * Provenance package surface: sources, captures, rights, evidence, lineage (BB-016).
 */
export {
  asSourceOrganizationId,
  asSourceDomainId,
  asSourceId,
  asSourceItemId,
  asSourceCaptureId,
  asRetrievalEventId,
  asEvidenceId,
  asEvidenceLineageId,
} from './ids.js';
export type {
  SourceOrganizationId,
  SourceDomainId,
  SourceId,
  SourceItemId,
  SourceCaptureId,
  RetrievalEventId,
  EvidenceId,
  EvidenceLineageId,
} from './ids.js';

export {
  sourceClassifications,
  isSourceClassification,
  assertSourceClassification,
} from './classifications.js';

export {
  RIGHTS_STATUSES,
  PUBLISHABLE_RIGHTS_STATUSES,
  PUBLICATION_PERMISSIONS,
  PROHIBITED_USES,
  isRightsStatus,
  isPublishableRightsStatus,
  requiresResolvedRights,
  assertRightsStatusForPublication,
  canPublishWithRights,
} from './rights.js';
export type {
  RightsStatus,
  PublishableRightsStatus,
  PublicationPermission,
  ProhibitedUse,
  ExcerptKind,
  PublicationContentKind,
  RightsPolicy,
  RightsGateInput,
} from './rights.js';

export {
  CONTENT_HASH_ALGORITHMS,
  normalizeContentHash,
  hashBytes,
  hashUtf8,
  contentHashesEqual,
  deduplicateCaptureByHash,
} from './hashes.js';
export type {
  ContentHashAlgorithm,
  ContentHash,
  HashDedupCandidate,
  HashDedupResult,
} from './hashes.js';

export {
  SNAPSHOT_MODES,
  assertSnapshotIsSelective,
  assertEvidenceSourceValid,
  canSourceAdapterCreateCandidates,
  assertSourceAdapterCanCreateCandidates,
  normalizeHostname,
} from './source.js';
export type {
  SnapshotMode,
  SourceOrganization,
  SourceDomain,
  SourceAdapterPolicy,
  EvidenceSource,
  SourceItem,
  SourceKillSwitchState,
} from './source.js';

export {
  RETRIEVAL_STATUSES,
  assertCaptureHashValid,
  assertSelectiveSnapshotPolicy,
  buildCaptureAfterDedup,
} from './capture.js';
export type { RetrievalStatus, RetrievalEvent, SourceCapture } from './capture.js';

export {
  assertEvidenceResolvesToSourceItem,
  assertEvidenceRecordValid,
  assertEvidenceMayPublish,
} from './evidence.js';
export type { EvidenceLocator, EvidenceRecord } from './evidence.js';

export {
  LINEAGE_KINDS,
  assertLineageEndpointsDistinct,
  resolveLineageRoot,
} from './lineage.js';
export type { LineageKind, EvidenceLineage } from './lineage.js';
