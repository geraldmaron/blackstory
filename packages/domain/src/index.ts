/**
 * Shared domain primitives for BlackStory entities, geography, provenance,
 * claims confidence, append-only audit contracts, immutable
 * publication releases, and source adapter registry contracts.
 * Living-status and public precision rules come from
 * @repo/schemas (constitution). Firestore converters live in @repo/firebase;
 * Cloud SQL PostGIS are deferred (ADR-011).
 */
export { asEntityId, asRelationshipId, asMergeId, asLocationId } from './ids.js';
export type { EntityId, RelationshipId, MergeId, LocationId } from './ids.js';

export {
  SEED_STORY_PROJECTIONS,
  listSeedStoryProjections,
  getSeedStoryProjection,
} from './publication/public-story-seed.js';

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

export {
  livingStatuses,
  treatAsLiving,
  DEFAULT_LIVING_STATUS,
  deriveLivingStatus,
} from './living.js';
export type { LivingStatus, LivingStatusDerivationSignal } from './living.js';

export { ENTITY_KINDS, isEntityKind } from './entity-kinds.js';
export type { EntityKind } from './entity-kinds.js';

// Coarse entity classification (the related workstream) additive to `kind`, not wired into any
// publish/search/filter pipeline in this pass.
export {
  ENTITY_CLASSES,
  isEntityClass,
  ENTITY_TYPES_BY_CLASS,
  isControlledEntityType,
  deriveEntityClassification,
} from './entity-class.js';
export type { EntityClass, EntityClassification } from './entity-class.js';

// Unified temporal naming + external-identifier contracts (the related workstream), plus the
// namespace/value uniqueness invariant. See ./naming.ts's module doc for scope rationale.
export {
  ENTITY_NAME_TYPES,
  migrateEntityNames,
  TRUSTED_IDENTIFIER_NAMESPACES,
  isTrustedIdentifierNamespace,
  migrateEntityIdentifiers,
  findIdentifierUniquenessViolations,
  assertIdentifierUniqueness,
} from './naming.js';
export type {
  EntityNameType,
  EntityName,
  EntityIdentifierRecord,
  IdentifierUniquenessViolation,
} from './naming.js';

export { currentEntityStatus, deriveEntityLivingStatus } from './entity.js';
export type { EntityAlias, EntityIdentifier, EntityMergeState, CanonicalEntity } from './entity.js';

export type {
  SchoolName,
  SchoolCampus,
  SchoolCampusStatus,
  /** @deprecated alias of SchoolMilestone see school.ts. */
  SchoolStatusEntry,
  SchoolMilestone,
  SchoolFields,
} from './school.js';

// entity ontology shared era/date-precision model, kind-specific status vocabularies,
// notability-basis inclusion rubric, and the schema-only sensitivity classification. Additive
// barrel export so packages/firebase/src/embeddings/text.ts can import the shared
// `deriveEraBuckets` (replacing its local duplicate) and so have a
// single vocabulary source to import from — see ADR-015.
export { DATE_PRECISIONS, deriveDecadeLabel, deriveEraBuckets, isDatePrecision } from './era.js';
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
export {
  deriveCatalogEntityStatus,
  type CatalogStatusSource,
  type DerivedCatalogStatus,
} from './derive-catalog-status.js';

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
  RELATIONSHIP_WORKFLOW_STATUSES,
  isRelationshipWorkflowStatus,
  RELATIONSHIP_PUBLICATION_STATUSES,
  isRelationshipPublicationStatus,
  RELATIONSHIP_RESOLUTION_STATES,
  isRelationshipResolutionState,
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
  RelationshipWorkflowStatus,
  RelationshipPublicationStatus,
  RelationshipResolutionState,
} from './relationship.js';

// publish invariants for EntityRelationship (BB the related workstream) not yet wired into a publish
// pipeline (release-builder bead the related workstream owns that wiring).
export {
  assertRelationshipEndpointsResolvedForPublish,
  excludeSelfFromCorroboration,
  assertRelationshipNotSoleSelfCorroboration,
  countUniqueSyndicatedEvidenceLineages,
  assertRelationshipPublishInvariants,
} from './relationship-publish.js';
export type {
  SelfCorroborationCheck,
  EvidenceLineageLookup,
  RelationshipPublishInvariantInput,
} from './relationship-publish.js';

// history graph substrate containment-chain materialization, derived per-entity
// adjacency per-decade all-time release views, succession-chain non-leakage, and
// FactRecord subjects mirroring. Mirrors ./graph/index.js's own barrel EXCEPT
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
  extractCatalogRelationships,
  relatedEntriesFromRelationships,
  RELATIONSHIP_CANDIDATE_TYPES,
  RELATIONSHIP_CANDIDATE_REASONS,
  proposeRelationshipCandidates,
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
  CatalogRelatedEntry,
  CatalogEntityForRelationships,
  ExtractCatalogRelationshipsOptions,
  ExtractCatalogRelationshipsResult,
  RelationshipCandidateType,
  RelationshipCandidateReason,
  RelationshipCandidate,
  RelationshipCandidateEntity,
  ExistingRelationshipRef,
  ProposeRelationshipCandidatesInput,
} from './graph/index.js';
// sensitivity presentation, present-day advisories, disclaimer registry.
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

// vetted-corpus bulk intake lane corpus-vetting gate + launch-corpus registrations.
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

// Jurisdiction reference registry — fail-closed dangling-reference gate for the
// projection build. See geography/jurisdiction-refs.ts for the not-wired-live call site.
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
  LOCATION_EVIDENCE_CLASSES,
  LOCATION_DRIFT_THRESHOLDS_METERS,
  LOCATION_AUDIT_ACTIONS,
  classifyLocationEvidence,
  driftThresholdMeters,
  suggestedPrecisionForEvidence,
  decideLocationCorrection,
  buildLocationGeocodeQuery,
  placeTitleCandidateFromLabel,
  placeTitleCandidatesFromLabel,
  isJurisdictionOnlyPlaceTitle,
  extractStreetFingerprint,
  streetAddressesCompatible,
} from './geography/location-audit.js';
export type {
  LocationEvidenceClass,
  LocationDriftTier,
  LocationAuditAction,
  LocationGeocodeHit,
  DecideLocationCorrectionInput,
  LocationCorrectionDecision,
  ClassifyLocationEvidenceInput,
} from './geography/location-audit.js';

export { buildEntityLocationFromResolution } from './geography/entity-location-from-geocode.js';
export type { BuildEntityLocationFromResolutionInput } from './geography/entity-location-from-geocode.js';

export { coordinateFromWikidataEntity } from './geography/wikidata-place-coords.js';
export type { WikidataPlaceCoordinate } from './geography/wikidata-place-coords.js';

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
  assertCanonicalClaimValid,
  assertCanonicalClaimMatchesCurrentVersion,
  isClaimPublished,
  findCurrentClaimVersion,
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
  CanonicalClaim,
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
export * from './external-data-sources.js';
export * from './public-numeric-policy.js';
export * from './publication/index.js';
export * from './datapacks/index.js';

// Map data platform. Demo/test fixtures in ./map/fixtures.js are
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
  aggregateDecadePresence,
  buildDecadePresenceAggregates,
  BLACK_POPULATION_CONCENTRATED_MIN,
  BLACK_POPULATION_EMERGING_MIN,
  bucketBlackPopulationTier,
  buildStateBlackPopulationDensityLevels,
  latestStatePopulationVintage,
  parseStatePopulationIndexFile,
  readStatePopulation,
  sumStateBlackPopulation,
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
  StatePresenceEntityInput,
  DecadePresenceEntityInput,
  DecadeStateAggregates,
  BlackPopulationDensityTier,
  StateBlackPopulationDensityLevel,
  StatePopulationIndex,
  StatePopulationIndexFile,
  StatePopulationRecord,
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
export * from './citation-independence/index.js';
export * from './geo-integrity/index.js';
export * from './capture-completeness/index.js';
export * from './editorial/index.js';
export * from './story-research/index.js';
export * from './rights/index.js';
export * from './consensus-review/index.js';
export * from './citations/index.js';
export * from './relevance-feedback/index.js';

// Public search domain layer: deterministic ranking, facets, explanations, and the
// notability-gate-enforcing search-index builder. Mirrors ./graph/index.js's own barrel.
export * from './search/index.js';

// Controlled historical-theme taxonomy (the related workstream): the registry, and the migration
// helper that splits legacy `topicTags` into topicIds/mentionedEntityIds/keywords.
export * from './taxonomy/index.js';

// Quality-first national seed campaigns: curated fixtures + fail-closed gate validators.
export * from './seed-campaigns/index.js';

// Canonical fact registry: FactRecord + publish gate + JSON-LD + subjects.
export * from './facts/index.js';

// geocode domain (Census Geocoder pipeline + jurisdiction resolution).
export * from './geocode/index.js';

// historic safety place-context engine (layered signals; crime stats never score).
export * from './historic-safety/index.js';
export * from './verification/index.js';

// Editorial trust vocabulary + ClaimReview path exclusivity.
export * from './trust/index.js';

// Legal landscape snapshot + monitoring.
export * from './legal/index.js';

// Learning-index entity contract (summary bars, tags, related hops, optional prose/photo).
export * from './learning-index/index.js';

// Statistics storage model: StatisticalSeries/StatisticalObservation/DerivedMeasurement + the
// safe-combination validators (disjoint-geography sums, MOE propagation, growth significance).
export * from './statistics/index.js';
export * from './demographics/index.js';
