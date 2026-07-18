
/**
 * Firestore model surface for Black Book (ADR-011 019).
 */
export { FIRESTORE_ROOT, firestorePaths } from './paths.js';
export type { FirestoreRootCollection } from './paths.js';

export {
  authClaimFlagsSchema,
  entityKindSchema,
  geoPointFieldsSchema,
  geoGeometrySchema,
  zipCodeInputSchema,
  geographicMatchSchema,
  entityLocationSchema,
  entityAliasSchema,
  entityIdentifierSchema,
  entityMergeStateSchema,
  schoolFieldsSchema,
  policyActiveSchema,
  policyVersionSchema,
  canonicalEntitySchema,
  entityRelationshipSchema,
  entityMergeSchema,
  claimTemporalContextSchema,
  claimGeographicContextSchema,
  confidenceComponentsSchema,
  confidenceScoreSchema,
  preservedClaimValueSchema,
  claimVersionSchema,
  researchCoverageSchema,
  relevanceMeasurementSchema,
  connectionStrengthSchema,
  canonicalClaimSchema,
  claimEvidenceLinkSchema,
  contentHashSchema,
  rightsStatusSchema,
  publicationPermissionSchema,
  prohibitedUseSchema,
  rightsPolicySchema,
  sourceOrganizationSchema,
  sourceDomainSchema,
  evidenceSourceSchema,
  sourceItemSchema,
  retrievalEventSchema,
  sourceCaptureSchema,
  evidenceLocatorSchema,
  evidenceRecordSchema,
  evidenceLineageSchema,
  publicationReleaseSchema,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  submissionInboxSchema,
  auditActorSchema,
  auditSubjectSchema,
  auditEventSchema,
  outboxMessageSchema,
  idempotencyRecordSchema,
  outboxConsumerReceiptSchema,
  killSwitchSchema,
} from './types.js';
export type {
  AuthClaimFlags,
  EntityKindDoc,
  GeoPointFields,
  GeoGeometryDoc,
  ZipCodeInputDoc,
  GeographicMatchDoc,
  EntityLocationDoc,
  PolicyActiveDoc,
  PolicyVersionDoc,
  CanonicalEntityDoc,
  EntityRelationshipDoc,
  EntityMergeDoc,
  ConfidenceComponentsDoc,
  ConfidenceScoreDoc,
  PreservedClaimValueDoc,
  ClaimVersionDoc,
  CanonicalClaimDoc,
  ClaimEvidenceLinkDoc,
  ContentHashDoc,
  RightsPolicyDoc,
  SourceOrganizationDoc,
  SourceDomainDoc,
  EvidenceSourceDoc,
  SourceItemDoc,
  RetrievalEventDoc,
  SourceCaptureDoc,
  EvidenceLocatorDoc,
  EvidenceRecordDoc,
  EvidenceLineageDoc,
  PublicationReleaseDoc,
  PublicActiveReleaseDoc,
  PublicEntityProjectionDoc,
  SubmissionInboxDoc,
  AuditEventDoc,
  OutboxMessageDoc,
  IdempotencyRecordDoc,
  OutboxConsumerReceiptDoc,
  KillSwitchDoc,
} from './types.js';

export {
  parseWithSchema,
  policyActiveConverter,
  policyVersionConverter,
  canonicalEntityConverter,
  entityLocationConverter,
  entityRelationshipConverter,
  entityMergeConverter,
  canonicalClaimConverter,
  claimVersionConverter,
  claimEvidenceLinkConverter,
  sourceOrganizationConverter,
  sourceDomainConverter,
  evidenceSourceConverter,
  sourceItemConverter,
  sourceCaptureConverter,
  retrievalEventConverter,
  evidenceRecordConverter,
  evidenceLineageConverter,
  publicationReleaseConverter,
  publicActiveReleaseConverter,
  publicEntityProjectionConverter,
  preparePublicEntityProjectionForWrite,
  submissionInboxConverter,
  auditEventConverter,
  outboxMessageConverter,
  idempotencyRecordConverter,
  outboxConsumerReceiptConverter,
  killSwitchConverter,
} from './converters.js';

export {
  DEFAULT_PUBLIC_MEDIA_BUCKET,
  entityPrimaryImageObjectPath,
  entityPrimaryImageObjectRef,
  type EntityPrimaryImageObjectRef,
} from './entity-media.js';

export {
  createAdminAtomicStore,
  commitWithAudit,
  consumeOutboxMessage,
  loadEntityPublicationHistory,
} from './audit-outbox.js';
export type {
  AtomicSnapshot,
  AtomicTransaction,
  AtomicStore,
  StateMutation,
  CommitWithAuditInput,
  CommitWithAuditResult,
  ConsumeOutboxResult,
} from './audit-outbox.js';

export { resolveStaffRoles, canPublish, canResearchWrite, researchMayPublish } from './claims.js';
export type { StaffRole } from './claims.js';

export {
  RELEASE_ACTIVATION_STATUSES,
  parseImmutablePublicationRelease,
  resolveActivePublicRelease,
  activatePublicationRelease,
} from './release-activation.js';
export type {
  ReleaseActivationStatus,
  ImmutablePublicationReleaseDoc,
  ActivePublicReleasePointer,
  ActivateReleaseInput,
  ActivateReleaseResult,
} from './release-activation.js';

export { promoteClaimToPublicationCandidate } from './promotion.js';
export type {
  AcceptedPromotionDoc,
  PublicationCandidateDoc,
  PromoteClaimInput,
  PromoteClaimResult,
} from './promotion.js';

export {
  RESEARCH_CASE_SERVER_ACTIONS,
  assertResearchCaseActionAuthorized,
  assertResearchCaseTransitionAuthorized,
  executeAuthorizedResearchCaseTransition,
  executeAuthorizedResearchCaseAction,
} from './research-case.js';
export type {
  ResearchCaseServerAction,
  ServerResearchCaseState,
} from './research-case.js';
