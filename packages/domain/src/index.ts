/**
 * Shared domain primitives for Black Book entities, geography (BB-014), provenance (BB-016),
 * claims / confidence (BB-017), append-only audit contracts (BB-018), immutable
 * publication releases (BB-019), and source adapter registry contracts (BB-037).
 * Living-status and public precision rules come from
 * @black-book/schemas (constitution). Firestore converters live in @black-book/firebase;
 * Cloud SQL / PostGIS are deferred (ADR-011).
 */
export { asEntityId, asRelationshipId, asMergeId, asLocationId } from './ids.js';
export type { EntityId, RelationshipId, MergeId, LocationId } from './ids.js';

export {
  asSourceOrganizationId,
  asSourceDomainId,
  asSourceId,
  asSourceItemId,
  asSourceCaptureId,
  asRetrievalEventId,
  asEvidenceId,
  asEvidenceLineageId,
  sourceClassifications,
  isSourceClassification,
  assertSourceClassification,
  RIGHTS_STATUSES,
  PUBLISHABLE_RIGHTS_STATUSES,
  PUBLICATION_PERMISSIONS,
  PROHIBITED_USES,
  isRightsStatus,
  isPublishableRightsStatus,
  requiresResolvedRights,
  assertRightsStatusForPublication,
  canPublishWithRights,
  CONTENT_HASH_ALGORITHMS,
  normalizeContentHash,
  hashBytes,
  hashUtf8,
  contentHashesEqual,
  deduplicateCaptureByHash,
  SNAPSHOT_MODES,
  assertSnapshotIsSelective,
  assertEvidenceSourceValid,
  canSourceAdapterCreateCandidates,
  assertSourceAdapterCanCreateCandidates,
  normalizeHostname,
  RETRIEVAL_STATUSES,
  assertCaptureHashValid,
  assertSelectiveSnapshotPolicy,
  buildCaptureAfterDedup,
  assertEvidenceResolvesToSourceItem,
  assertEvidenceRecordValid,
  assertEvidenceMayPublish,
  LINEAGE_KINDS,
  assertLineageEndpointsDistinct,
  resolveLineageRoot,
} from './provenance/index.js';
export type {
  SourceOrganizationId,
  SourceDomainId,
  SourceId,
  SourceItemId,
  SourceCaptureId,
  RetrievalEventId,
  EvidenceId,
  EvidenceLineageId,
  RightsStatus,
  PublishableRightsStatus,
  PublicationPermission,
  ProhibitedUse,
  ExcerptKind,
  PublicationContentKind,
  RightsPolicy,
  RightsGateInput,
  ContentHashAlgorithm,
  ContentHash,
  HashDedupCandidate,
  HashDedupResult,
  SnapshotMode,
  SourceOrganization,
  SourceDomain,
  SourceAdapterPolicy,
  EvidenceSource,
  SourceItem,
  SourceKillSwitchState,
  RetrievalStatus,
  RetrievalEvent,
  SourceCapture,
  EvidenceLocator,
  EvidenceRecord,
  LineageKind,
  EvidenceLineage,
} from './provenance/index.js';

export { livingStatuses, treatAsLiving, DEFAULT_LIVING_STATUS } from './living.js';
export type { LivingStatus } from './living.js';

export { ENTITY_KINDS, isEntityKind } from './entity-kinds.js';
export type { EntityKind } from './entity-kinds.js';

export type { EntityAlias, EntityIdentifier, EntityMergeState, CanonicalEntity } from './entity.js';

export type {
  SchoolName,
  SchoolCampus,
  SchoolCampusStatus,
  SchoolStatusEntry,
  SchoolFields,
} from './school.js';

export type {
  PersonFields,
  OrganizationFields,
  InstitutionFields,
  EventFields,
  LawFields,
  CaseFields,
  PublicationFields,
  ArtifactFields,
} from './specialized.js';

export { RELATIONSHIP_TYPES, assertRelationshipHasEvidence } from './relationship.js';
export type {
  RelationshipType,
  TemporalContext,
  GeographicRelationshipContext,
  EntityRelationship,
} from './relationship.js';

export { assertMergeReversible, reverseMerge, isMergeActive } from './merge.js';
export type { EntityMergeStatus, EntityMergeRecord } from './merge.js';

export {
  encodeGeohash,
  geohashPrefixes,
  buildGeoPointFields,
  haversineMeters,
  DEFAULT_GEOHASH_PRECISION,
  MAX_GEOHASH_PRECISION,
} from './geography/geohash.js';
export type { GeoPoint, GeoPointFields } from './geography/geohash.js';

export {
  allowedPublicPrecisionLevels,
  prohibitedPublicPrecisionLevels,
  assertPublicPrecisionAllowed,
  isPublicPrecisionAllowed,
} from './geography/precision.js';
export type { PublicPrecisionLevel } from './geography/precision.js';

export {
  GEOGRAPHIC_MATCH_METHODS,
  assertZipNotHistoricalBoundary,
  locationsMayCoexist,
  hasHistoricalAndCurrent,
} from './geography/location.js';
export type {
  GeoGeometry,
  LocationRole,
  GeographicMatchMethod,
  GeographicMatch,
  ZipCodeRole,
  ZipCodeInput,
  JurisdictionKind,
  Jurisdiction,
  EntityLocation,
  PlaceFields,
} from './geography/location.js';

export {
  asClaimId,
  asClaimVersionId,
  asClaimEvidenceLinkId,
  CLAIM_WORKFLOW_STATUSES,
  CLAIM_PUBLICATION_STATUSES,
  isClaimWorkflowStatus,
  isClaimPublicationStatus,
  assertProceduralStatusRecognized,
  assertClaimVersionValid,
  assertAtomicClaimValid,
  isClaimPublished,
  currentClaimVersion,
  claimClassThreshold,
  CLAIM_EVIDENCE_ROLES,
  isClaimEvidenceRole,
  assertClaimEvidenceLinkValid,
  linksForRole,
  CONFIDENCE_COMPONENT_WEIGHTS,
  sourceAuthorityForClassification,
  lineageIndependenceFromCount,
  uniqueLineageAggregates,
  calculateClaimConfidence,
  RESEARCH_COVERAGE_LEVELS,
  isResearchCoverageLevel,
  assertResearchCoverageLevel,
  assertUnitInterval,
  measureRelevance,
  measureConnectionStrength,
  defaultResearchCoverage,
  preserveContradictoryValues,
  assertContradictionsPreserved,
  evaluatePublicationThreshold,
  highImpactUsesHigherThreshold,
  assertHighImpactThresholdHigher,
  assertNarrativeMayCiteClaim,
  narrativeMayCiteClaim,
  assertClaimMayPublish,
} from './claims/index.js';
export type {
  ClaimId,
  ClaimVersionId,
  ClaimEvidenceLinkId,
  ClaimWorkflowStatus,
  ClaimPublicationStatus,
  ClaimGeographicContext,
  ClaimVersion,
  AtomicClaim,
  PreservedClaimValue,
  ClaimEvidenceRole,
  ClaimEvidenceLink,
  ConfidenceComponents,
  ConfidenceScore,
  ConfidenceEngineInput,
  ConfidenceEngineResult,
  ResearchCoverageLevel,
  ResearchCoverage,
  RelevanceMeasurement,
  ConnectionStrengthMeasurement,
  ContradictionSet,
  PublicationThresholdResult,
} from './claims/index.js';

export {
  AUDIT_EVENT_ACTIONS,
  ACTOR_TYPES,
  OUTBOX_STATUSES,
  auditCategoryFor,
  isPublicationHistoryEvent,
  reconstructPublicationHistory,
} from './audit/index.js';
export type {
  AuditEventAction,
  AuditEventCategory,
  ActorType,
  AuditActor,
  AuditSubject,
  DomainAuditEvent,
  OutboxStatus,
  DomainOutboxMessage,
  PublicationHistoryEntry,
} from './audit/index.js';

export * from './adapters/index.js';
export * from './publication/index.js';
export * from './query-packs/index.js';
export * from './discovery/index.js';
export * from './relevance/index.js';
export * from './resolution/index.js';
export * from './promotion/index.js';
export * from './extraction/index.js';
export * from './confidence-engine/index.js';
export * from './research-case/index.js';
