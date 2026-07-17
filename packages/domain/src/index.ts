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

export { currentEntityStatus } from './entity.js';
export type { EntityAlias, EntityIdentifier, EntityMergeState, CanonicalEntity } from './entity.js';

export type {
  SchoolName,
  SchoolCampus,
  SchoolCampusStatus,
  /** @deprecated alias of SchoolMilestone — see school.ts (BB-090 naming-collision fix). */
  SchoolStatusEntry,
  SchoolMilestone,
  SchoolFields,
} from './school.js';

// BB-090: entity ontology — shared era/date-precision model, kind-specific status vocabularies,
// notability-basis inclusion rubric, and the schema-only sensitivity classification. Additive
// barrel export so packages/firebase/src/embeddings/text.ts can import the shared
// `deriveEraBuckets` (replacing its local duplicate) and so BB-086/BB-087/BB-092/BB-095 have a
// single vocabulary source to import from — see ADR-015.
export {
  DATE_PRECISIONS,
  deriveDecadeLabel,
  deriveEraBuckets,
  isDatePrecision,
} from './era.js';
export type { DatePrecision, EraSpan } from './era.js';

export {
  CULTURAL_FIGURE_NOTABILITY_CALIBRATION,
  CULTURAL_FIGURE_NOTABILITY_CALIBRATION_NOTE,
  LAW_STATUSES,
  MOVEMENT_STATUSES,
  NOTABILITY_CRITERIA,
  NOTABILITY_RUBRIC,
  PLACE_LIKE_STATUSES,
  PLACE_LIKE_STATUS_KINDS,
  SENSITIVITY_CLASSES,
  STATUSLESS_ENTITY_KINDS,
  currentStatus,
  hasRequiredNotabilityBasis,
  personStatusFromLiving,
  statusAsOf,
} from './entity-status.js';
export type {
  EntitySensitivity,
  EntityStatusValue,
  LawStatus,
  MovementStatus,
  NotabilityBasisRecord,
  NotabilityCriterion,
  PersonDerivedStatus,
  PlaceLikeStatus,
  PlaceLikeStatusKind,
  SensitivityClass,
  StatuslessEntityKind,
  StatusHistoryEntry,
} from './entity-status.js';

export type { MovementFields } from './movement.js';

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

export {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_ROLES,
  assertRelationshipHasEvidence,
  RELATIONSHIP_TYPE_SEMANTICS,
  CAUSAL_HISTORICAL_RELATIONSHIP_TYPES,
  relationshipRequiresTemporalContext,
  assertRelationshipTemporalRequirement,
  assertRelationshipRoleValidForType,
  CAUSAL_ASSERTION_RELATIONSHIP_TYPES,
  isCausalAssertionRelationshipType,
  CAUSATION_SCOPES,
  evaluateCausalEdgeGuardrail,
  assertCausalEdgeGuardrail,
} from './relationship.js';
export type {
  RelationshipType,
  RelationshipRole,
  TemporalContext,
  GeographicRelationshipContext,
  EntityRelationship,
  RelationshipTypeSemantics,
  CausalAssertionRelationshipType,
  CausationScope,
  CausalEdgeReview,
  CausalGuardrailResult,
} from './relationship.js';

// BB-092: history graph substrate — containment-chain materialization, derived per-entity
// adjacency / per-decade / all-time release views, succession-chain non-leakage, and BB-086
// FactRecord subjects[] mirroring. Mirrors ./graph/index.js's own barrel EXCEPT
// GRAPH_GOLD_FIXTURES, which stays internal-only (same convention as ./map/fixtures.js below).
export {
  CONTAINMENT_RELATIONSHIP_TYPES,
  isContainmentRelationshipType,
  MAX_CONTAINMENT_DEPTH,
  buildContainmentIndex,
  resolveEntityContainmentPath,
  resolveEntityContainmentPaths,
  createInMemoryJurisdictionParentLookup,
  extendJurisdictionChain,
  mirrorFactSubjectsIntoRelationships,
  DEFAULT_ADJACENCY_CAP,
  buildEntityAdjacency,
  buildAllEntityAdjacency,
  toPublicRelatedEntries,
  deriveActiveDecadeBuckets,
  buildDecadeViews,
  buildAllTimeView,
  resolveSuccessionEndpoints,
  buildSuccessionLinkedContext,
  buildSuccessorPublicView,
  publicGraphAdjacencyPath,
  publicGraphDecadePath,
  publicGraphAllTimePath,
  buildGraphReleaseArtifact,
  assertGraphReleaseArtifactReproducible,
  publicRelatedEntriesByEntityId,
} from './graph/index.js';
export type {
  ContainmentRelationshipType,
  ContainmentEdgeInput,
  ContainmentEntityInput,
  ContainmentChainHop,
  ContainmentPath,
  JurisdictionParentLookup,
  ExtendJurisdictionChainResult,
  FactSubjectRef,
  FactSubjectSource,
  MirroredFactSubjectRelationship,
  AdjacencyDirection,
  PublicRelatedEntry,
  AdjacencyEntry,
  EntityAdjacency,
  BuildEntityAdjacencyOptions,
  DecadeBucketEntityInput,
  DeriveActiveDecadeBucketsOptions,
  DecadeGraphView,
  BuildDecadeViewsInput,
  AllTimeGraphView,
  SuccessionEdge,
  LinkedHistoricalContextEntry,
  SuccessorPublicView,
  GraphReleaseArtifactInput,
  GraphReleaseArtifact,
} from './graph/index.js';

// BB-095: sensitivity presentation, present-day advisories, disclaimer registry.
export {
  ADVISORY_CLASSES,
  isAdvisoryClass,
  ADVISORY_CLASS_LABELS,
  SUGGESTED_ADVISORY_REVIEW_CADENCES,
  AdvisoryValidationError,
  assertAdvisoryRecordValid,
  PROHIBITED_ADVISORY_LANGUAGE,
  assertProceduralAdvisoryLanguage,
  buildAdvisoryStatement,
  ADVISORY_SCORING_BANNED_KEYS,
  assertAdvisoryAbsentFromScoringInput,
  ADVISORY_SCORING_TYPE_INVARIANTS,
} from './advisory.js';
export type { AdvisoryClass, PlaceAdvisoryRecord } from './advisory.js';

export {
  DISCLAIMER_REGISTRY_VERSION,
  DISCLAIMER_CLASSES,
  DISCLAIMER_REGISTRY,
  getDisclaimer,
  assertDisclaimerRegistryComplete,
  SENSITIVITY_CLASS_PRESENTATION_LABELS,
  IDENTITY_ATTRIBUTE_TERMS,
  assertNoIdentityAttributeFraming,
} from './disclaimers.js';
export type { DisclaimerClass, DisclaimerRecord } from './disclaimers.js';

// BB-094: vetted-corpus bulk intake lane — corpus-vetting gate + launch-corpus registrations.
// Streamlined-promotion logic (spot-check sampling, batch reporting) lives in
// ./promotion/corpus-promotion.js, re-exported via ./promotion/index.js below.
export {
  LICENSE_VERDICTS,
  isLicenseVerdict,
  BULK_IMPORT_ELIGIBLE_LICENSE_VERDICTS,
  isBulkImportEligibleLicenseVerdict,
  CORPUS_AUTHORITY_TIERS,
  isCorpusAuthorityTier,
  REFRESH_CADENCES,
  isRefreshCadence,
  EXCLUDED_CORPUS_LANES,
  assertCorpusNotInExcludedLane,
  assertCorpusVettingRecordValid,
  createInMemoryCorpusVettingStore,
  corpusSourceRegistryEntryId,
  corpusAdapterId,
  registerCorpusVetting,
  quarantineCorpusRegistryEntry,
  CORPUS_BULK_IMPORT_KILL_SWITCH_PREFIX,
  corpusBulkImportKillSwitchId,
  parseCorpusBulkImportKillSwitchId,
  assertCorpusBulkImportBudgetValid,
  assertWithinCorpusBulkImportBudget,
  assertCorpusVettedForBulkImport,
  isCorpusVettedForBulkImport,
} from './corpus-vetting.js';
export type {
  LicenseVerdict,
  CorpusAuthorityTier,
  RefreshCadence,
  CorpusVettingRecord,
  CorpusVettingStore,
  RegisterCorpusVettingInput,
  CorpusBulkImportBudget,
  CorpusVettingGateResult,
} from './corpus-vetting.js';

export {
  buildLaunchCorpusVettingInputs,
  registerLaunchCorpora,
  LAUNCH_CORPUS_SLUGS,
  BOUNDARY_EXCLUDED_CORPUS_SLUGS,
} from './launch-corpora.js';

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
  GEO_PRECISION_TIERS,
  isGeoPrecisionTier,
  GEO_PRECISION_TIER_RANK,
  isCoarserGeoPrecisionTier,
  coarserGeoPrecisionTier,
  PRECISION_BASES,
  isPrecisionBasis,
  FIXED_TIER_RADIUS_METERS,
  boundingRadiusMeters,
  displayRadiusMeters,
  resolveEntityLocationPrecision,
} from './geography/precision.js';
export type {
  PublicPrecisionLevel,
  GeoPrecisionTier,
  PrecisionBasis,
  JurisdictionBBox,
  DisplayRadiusInput,
  ResolveEntityLocationPrecisionInput,
  ResolvedEntityLocationPrecision,
} from './geography/precision.js';

// BB-091: jurisdiction reference registry — fail-closed dangling-reference gate for the
// projection build. See geography/jurisdiction-refs.ts's INTEGRATION POINT comment.
export {
  createInMemoryJurisdictionResolver,
  evaluateJurisdictionReferences,
  assertJurisdictionReferencesResolve,
  jurisdictionReferenceFromLaw,
  jurisdictionReferenceFromLocation,
} from './geography/jurisdiction-refs.js';
export type {
  JurisdictionResolver,
  JurisdictionIdSet,
  JurisdictionReferenceSubject,
  DanglingJurisdictionReference,
  JurisdictionReferenceCheckResult,
} from './geography/jurisdiction-refs.js';

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

// Map data platform (BB-070). Demo/test fixtures in ./map/fixtures.js are
// intentionally NOT re-exported here — they are internal to this package
// (imported by relative path from map-source.test.ts and the demo generator
// script), the same way packages/firebase/fixtures/ sits outside that
// package's public src/index.ts surface.
export {
  US_STATES,
  US_BOUNDS,
  isWithinUsBounds,
  findUsStateForPoint,
  findUsStateByPostalCode,
  buildMapSource,
} from './map/index.js';
export type {
  UsStateInfo,
  MapSourceRawLocation,
  MapSourceEntityInput,
  MapRedactedLocation,
  MapRedactLocationFn,
  MapPointFeatureProperties,
  MapPointFeature,
  MapFeatureCollection,
  MapStateAggregate,
  MapCountyAggregate,
  MapSourceMeta,
  MapSourceBuildResult,
  BuildMapSourceInput,
} from './map/index.js';
export * from './query-packs/index.js';
export * from './discovery/index.js';
export * from './relevance/index.js';
export * from './resolution/index.js';
export * from './promotion/index.js';
export * from './extraction/index.js';
export * from './confidence-engine/index.js';
export * from './research-case/index.js';
export * from './similarity/index.js';
export * from './rights/index.js';
export * from './consensus-review/index.js';
export * from './citations/index.js';
export * from './relevance-feedback/index.js';

// Public search domain layer (BB-049): deterministic ranking, facets, explanations, and the
// notability-gate-enforcing search-index builder. Mirrors ./graph/index.js's own barrel.
export * from './search/index.js';

// Quality-first national seed campaigns (BB-058): curated fixtures + fail-closed gate validators.
export * from './seed-campaigns/index.js';

// Canonical fact registry (BB-086): FactRecord + publish gate + JSON-LD + subjects.
export * from './facts/index.js';

// BB-050 geocode domain (Census Geocoder pipeline + jurisdiction resolution).
export * from './geocode/index.js';

// BB-082 historic safety / place-context engine (layered signals; crime stats never score).
export * from './historic-safety/index.js';

// Editorial trust vocabulary + ClaimReview path exclusivity (BB-088).
export * from './trust/index.js';

// Legal landscape snapshot + monitoring (BB-087).
export * from './legal/index.js';
