
/**
 * Firestore document schemas for Black Book (ADR-011 018).
 * Entity/geography, provenance, claims/confidence.
 * Shapes align with @blap/domain; Cloud SQL PostGIS are not the production path.
 */
import { z } from 'zod';
import {
  ACTOR_TYPES,
  AUDIT_EVENT_ACTIONS,
  OUTBOX_STATUSES,
  auditCategoryFor,
} from '@blap/domain';

export const authClaimFlagsSchema = z.object({
  admin: z.boolean().optional(),
  research: z.boolean().optional(),
  publication: z.boolean().optional(),
  security: z.boolean().optional(),
  bb_role: z.enum(['admin', 'research', 'publication', 'security']).optional(),
});

export type AuthClaimFlags = z.infer<typeof authClaimFlagsSchema>;

export const entityKindSchema = z.enum([
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  // 12th kind: sustained, multi-actor, multi-decade phenomena (Civil Rights Movement,
  // Great Migration, Black Power, Black Arts Movement, etc.) distinct from a single `event`.
  'movement',
  'other',
]);

export type EntityKindDoc = z.infer<typeof entityKindSchema>;

export const geoPointFieldsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Full geohash string for the point (precision chosen by writers). */
  geohash: z.string().min(1).max(12),
  /** Optional prefixes for range queries (e.g. length 1..geohash.length). */
  geohashPrefixes: z.array(z.string().min(1)).max(12).optional(),
  /** Constitution public precision level when this point is public-facing. */
  precision: z.string().min(1).optional(),
  /** How the coordinate was derived (manual_research, geocode_census, …). */
  matchMethod: z.string().min(1).optional(),
});

export type GeoPointFields = z.infer<typeof geoPointFieldsSchema>;

export const geoGeometrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(4),
  }),
  z.object({
    type: z.literal('BBox'),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
]);

export type GeoGeometryDoc = z.infer<typeof geoGeometrySchema>;

export const zipCodeInputSchema = z.object({
  zip: z.string().min(3).max(16),
  /** ZIP is modern input/lookup only never a historical boundary. */
  role: z.enum(['modern_input', 'modern_lookup']),
  countryCode: z.string().min(2).max(3).optional(),
});

export type ZipCodeInputDoc = z.infer<typeof zipCodeInputSchema>;

export const geographicMatchSchema = z.object({
  method: z.enum([
    'manual_research',
    'geocode_census',
    'geocode_other',
    'geohash_nearby',
    'user_submitted',
    'imported',
    'unknown',
  ]),
  precision: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  recordedAt: z.string().datetime(),
  notes: z.string().optional(),
});

export type GeographicMatchDoc = z.infer<typeof geographicMatchSchema>;

export const entityLocationSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  role: z.enum(['historical', 'current', 'approximate']),
  geometry: geoGeometrySchema,
  point: geoPointFieldsSchema.optional(),
  precision: z.string().min(1),
  match: geographicMatchSchema.optional(),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  jurisdictionIds: z.array(z.string().min(1)).optional(),
  modernZip: zipCodeInputSchema.optional(),
  label: z.string().optional(),
  evidenceIds: z.array(z.string().min(1)).optional(),
});

export type EntityLocationDoc = z.infer<typeof entityLocationSchema>;

export const entityAliasSchema = z.object({
  value: z.string().min(1),
  kind: z.enum(['former_name', 'aka', 'spelling', 'translated', 'other']).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  primary: z.boolean().optional(),
});

export const entityIdentifierSchema = z.object({
  system: z.string().min(1),
  value: z.string().min(1),
  note: z.string().optional(),
});

export const entityMergeStateSchema = z.object({
  status: z.enum(['active', 'merged_away', 'superseded']),
  survivorId: z.string().min(1).optional(),
  mergeIds: z.array(z.string().min(1)).default([]),
});

export const schoolFieldsSchema = z.object({
  names: z
    .array(
      z.object({
        name: z.string().min(1),
        validFrom: z.string().optional(),
        validTo: z.string().nullable().optional(),
        primary: z.boolean().optional(),
      }),
    )
    .default([]),
  campuses: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        locationId: z.string().min(1),
        status: z.enum(['active', 'closed', 'relocated', 'unknown']),
        validFrom: z.string().optional(),
        validTo: z.string().nullable().optional(),
      }),
    )
    .default([]),

  /**
   * Renamed from `statusHistory` to `milestones` to resolve a naming collision with the
   * entity-level `canonicalEntitySchema.statusHistory` below (a different, closed-vocabulary
   * shape; see packages/domain/src/school.ts). This remains a free-text operational timeline
   * ("opened", "relocated"), not the entity's lifecycle status.
   */
  milestones: z
    .array(
      z.object({
        status: z.string().min(1),
        at: z.string().min(1),
        evidenceIds: z.array(z.string().min(1)).optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

// ---------------------------------------------------------------------------
// Entity ontology: shared date-precision model, entity-lifecycle status history,
// notability-basis inclusion rubric, and the schema-only sensitivity classification. Mirrors
// packages/domain/src/era.ts and packages/domain/src/entity-status.ts. Vocabularies are
// hardcoded here (not imported from @blap/domain) to match this file's existing convention
// (e.g. entityKindSchema above hardcodes ENTITY_KINDS rather than importing it).
// ---------------------------------------------------------------------------

export const datePrecisionSchema = z.enum(['day', 'month', 'year', 'decade', 'circa']);

export type DatePrecisionDoc = z.infer<typeof datePrecisionSchema>;


/**
 * Entity-lifecycle status only: place/school/organization/institution
 * active|historic|inactive, law in_force|amended|repealed|struck_down|enjoined, movement
 * active|historic. NEVER an area/condition designation (sundown-town, redlining grade,
 * exclusion infrastructure) — those are their own, separately-typed layer records.
 */
export const statusHistoryEntrySchema = z.object({
  status: z.string().min(1),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  datePrecision: datePrecisionSchema,
  basisClaimIds: z.array(z.string().min(1)).default([]),
});

export type StatusHistoryEntryDoc = z.infer<typeof statusHistoryEntrySchema>;

export const notabilityCriterionSchema = z.enum([
  'first_to_do_x',
  'major_honor_or_hall_of_fame',
  'landmark_or_national_register',
  'court_precedent',
  'movement_significance',
  'documented_site',
  'community_anchor',
  'only_or_oldest',
]);

export type NotabilityCriterionDoc = z.infer<typeof notabilityCriterionSchema>;

/** Auditable inclusion basis never a numeric score (standing policy bans numeric notability
 * scores from public payloads). */
export const notabilityBasisRecordSchema = z.object({
  criterion: notabilityCriterionSchema,
  note: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
});

export type NotabilityBasisRecordDoc = z.infer<typeof notabilityBasisRecordSchema>;

export const sensitivityClassSchema = z.enum([
  'contested_legacy',
  'perpetrator_associated',
  'violence_associated',
  'enslaver_or_segregationist',
]);

export type SensitivityClassDoc = z.infer<typeof sensitivityClassSchema>;

/** Schema only presentation (disclaimers, content warnings) is. */
export const entitySensitivitySchema = z.object({
  class: sensitivityClassSchema,
  note: z.string().min(1),
  basisClaimIds: z.array(z.string().min(1)).default([]),
});

export type EntitySensitivityDoc = z.infer<typeof entitySensitivitySchema>;

/** Field bag for the `movement` entity kind. */
export const movementFieldsSchema = z.object({
  startYear: z.number().int().optional(),
  endYear: z.number().int().nullable().optional(),
  ongoing: z.boolean().optional(),
  keyOrganizationIds: z.array(z.string().min(1)).default([]),
  keyPersonIds: z.array(z.string().min(1)).default([]),
  regionJurisdictionIds: z.array(z.string().min(1)).default([]),
  summary: z.string().optional(),
});

export type MovementFieldsDoc = z.infer<typeof movementFieldsSchema>;

export const policyActiveSchema = z.object({
  policyVersion: z.string().min(1),
  activatedAt: z.string().datetime(),
});

export type PolicyActiveDoc = z.infer<typeof policyActiveSchema>;

export const policyVersionSchema = z.object({
  policyVersion: z.string().min(1),
  checksum: z.string().min(1),
  notes: z.string().optional(),
});

export type PolicyVersionDoc = z.infer<typeof policyVersionSchema>;

export const canonicalEntitySchema = z.object({
  id: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  aliases: z.array(entityAliasSchema).optional(),
  identifiers: z.array(entityIdentifierSchema).optional(),
  livingStatus: z.enum(['living', 'deceased', 'unknown']).default('unknown'),
  mergeState: entityMergeStateSchema.optional(),
  /** Entity-lifecycle status only omitted for `event`/`person` kinds by convention. See the
   * scope-guardrail comment on statusHistoryEntrySchema above. */
  statusHistory: z.array(statusHistoryEntrySchema).optional(),
  /** >=1 record required to publish enforced by
   * @blap/domain's assertPublishableEntityHasNotabilityBasis, not by this schema alone. */
  notabilityBasis: z.array(notabilityBasisRecordSchema).optional(),
  /** Schema-only; presentation lives in the UI layer. */
  sensitivity: z.array(entitySensitivitySchema).optional(),
  person: z
    .object({
      livingStatus: z.enum(['living', 'deceased', 'unknown']),
      birthYear: z.number().int().nullable().optional(),
      deathYear: z.number().int().nullable().optional(),
      biographySummary: z.string().optional(),
    })
    .optional(),
  place: z
    .object({
      historicalNames: z.array(z.string().min(1)).optional(),
      jurisdictionIds: z.array(z.string().min(1)).optional(),
      primaryLocationId: z.string().min(1).optional(),
    })
    .optional(),
  school: schoolFieldsSchema.optional(),
  organization: z
    .object({
      orgType: z.string().optional(),
      foundedYear: z.number().int().nullable().optional(),
      dissolvedYear: z.number().int().nullable().optional(),
    })
    .optional(),
  institution: z
    .object({
      institutionType: z.string().optional(),
      foundedYear: z.number().int().nullable().optional(),
      closedYear: z.number().int().nullable().optional(),
    })
    .optional(),
  event: z
    .object({
      startAt: z.string().optional(),
      endAt: z.string().nullable().optional(),
      eventType: z.string().optional(),
    })
    .optional(),
  law: z
    .object({
      enactedAt: z.string().optional(),
      repealedAt: z.string().nullable().optional(),
      jurisdictionId: z.string().optional(),
      citation: z.string().optional(),
    })
    .optional(),
  case: z
    .object({
      filedAt: z.string().optional(),
      decidedAt: z.string().nullable().optional(),
      courtName: z.string().optional(),
      citation: z.string().optional(),
      proceduralStatus: z.string().optional(),
    })
    .optional(),
  publication: z
    .object({
      publishedAt: z.string().optional(),
      publisher: z.string().optional(),
      isbnOrIdentifier: z.string().optional(),
    })
    .optional(),
  artifact: z
    .object({
      artifactType: z.string().optional(),
      createdAtApprox: z.string().optional(),
      holdingInstitutionId: z.string().optional(),
    })
    .optional(),
  movement: movementFieldsSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CanonicalEntityDoc = z.infer<typeof canonicalEntitySchema>;


/**
 * Historical-causation edges (caused/enabled/influenced/participated_in/overturned/
 * commemorates) plus `authored` (creation attribution, distinct from `founded`). Direction and
 * temporal semantics for every type are documented in `@blap/domain`'s
 * `RELATIONSHIP_TYPE_SEMANTICS` (packages/domain/src/relationship.ts) hardcoded here, not
 * imported, to match this file's existing convention (see the entityKindSchema comment above).
 */
export const relationshipTypeSchema = z.enum([
  'located_at',
  'occurred_at',
  'attended',
  'founded',
  'employed_by',
  'member_of',
  'related_to',
  'depicts',
  'cites',
  'governed_by',
  'part_of',
  'successor_of',
  'caused',
  'enabled',
  'influenced',
  'participated_in',
  'overturned',
  'commemorates',
  'authored',
  'other',
]);

export type RelationshipTypeDoc = z.infer<typeof relationshipTypeSchema>;

/** Role qualifier valid ONLY on `type: 'attended'`; see
 * `@blap/domain`'s `assertRelationshipRoleValidForType`. */
export const relationshipRoleSchema = z.enum(['organizer', 'speaker', 'participant']);

export type RelationshipRoleDoc = z.infer<typeof relationshipRoleSchema>;

const unitInterval = z.number().min(0).max(1);

/** Same shape as `claimVersionSchema`/`canonicalClaimSchema`'s workflow/publication enums (see
 * below), reused by name for cross-domain consistency see `@blap/domain`'s
 * `RELATIONSHIP_WORKFLOW_STATUSES`/`RELATIONSHIP_PUBLICATION_STATUSES`. Relationships add an
 * explicit `candidate` state claims don't have, for the candidate -> review -> published
 * pipeline (BB black-book-hx8j). */
export const relationshipWorkflowStatusSchema = z.enum(['candidate', 'in_review', 'accepted', 'rejected']);
export type RelationshipWorkflowStatusDoc = z.infer<typeof relationshipWorkflowStatusSchema>;

export const relationshipPublicationStatusSchema = z.enum(['unpublished', 'published', 'retracted']);
export type RelationshipPublicationStatusDoc = z.infer<typeof relationshipPublicationStatusSchema>;

/** See `@blap/domain`'s `RelationshipResolutionState` doc comment: distinct from
 * `ResolutionOutcome` (a single candidate-to-entity match decision) this describes the joint
 * resolution state of both of an edge's endpoints. */
export const relationshipResolutionStateSchema = z.enum(['unresolved', 'partially_resolved', 'resolved']);
export type RelationshipResolutionStateDoc = z.infer<typeof relationshipResolutionStateSchema>;

export const confidenceComponentsSchema = z.object({
  sourceAuthority: unitInterval,
  directness: unitInterval,
  lineageIndependence: unitInterval,
  temporalProximity: unitInterval,
  geographicPrecision: unitInterval,
  entityMatchQuality: unitInterval,
  extractionQuality: unitInterval,
  contradictionPenalty: unitInterval,
});

export type ConfidenceComponentsDoc = z.infer<typeof confidenceComponentsSchema>;

export const confidenceScoreSchema = z.object({
  score: unitInterval,
  components: confidenceComponentsSchema,
  policyVersion: z.string().min(1),
  independentLineageCount: z.number().int().nonnegative(),
  supportingEvidenceCount: z.number().int().nonnegative(),
  contradictingEvidenceCount: z.number().int().nonnegative(),
  contributingEvidenceIds: z.array(z.string().min(1)).default([]),
  calculatedAt: z.string().datetime(),
});

export type ConfidenceScoreDoc = z.infer<typeof confidenceScoreSchema>;

export const entityRelationshipSchema = z.object({
  id: z.string().min(1),
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
  type: relationshipTypeSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  temporal: z
    .object({
      label: z.string().optional(),
      validFrom: z.string().optional(),
      validTo: z.string().nullable().optional(),
    })
    .optional(),
  geographic: z
    .object({
      locationId: z.string().optional(),
      jurisdictionId: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  /** Only meaningful when `type === 'attended'`. */
  role: relationshipRoleSchema.optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // ---------------------------------------------------------------------------------------
  // lifecycle/workflow fields (BB black-book-hx8j). All optional: pre-existing relationship
  // docs predate this pipeline and remain valid without a backfill migration.
  // ---------------------------------------------------------------------------------------
  workflowStatus: relationshipWorkflowStatusSchema.optional(),
  publicationStatus: relationshipPublicationStatusSchema.optional(),
  /** Reuses `confidenceScoreSchema` rather than a parallel relationship-specific shape. */
  confidence: confidenceScoreSchema.optional(),
  independentLineageCount: z.number().int().nonnegative().optional(),
  resolutionState: relationshipResolutionStateSchema.optional(),
  createdFromCandidateId: z.string().min(1).optional(),
  lastVerifiedAt: z.string().datetime().optional(),
});

export type EntityRelationshipDoc = z.infer<typeof entityRelationshipSchema>;

export const entityMergeSchema = z.object({
  id: z.string().min(1),
  survivorId: z.string().min(1),
  absorbedIds: z.array(z.string().min(1)).min(1),
  status: z.enum(['active', 'reversed']),
  reason: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  reversedAt: z.string().datetime().optional(),
  reversedBy: z.string().min(1).optional(),
  reverseReason: z.string().optional(),
  auditEventIds: z.array(z.string().min(1)).default([]),
});

export type EntityMergeDoc = z.infer<typeof entityMergeSchema>;

export const claimTemporalContextSchema = z.object({
  label: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
});

export const claimGeographicContextSchema = z.object({
  locationId: z.string().min(1).optional(),
  jurisdictionId: z.string().min(1).optional(),
  notes: z.string().optional(),
  precision: z.string().min(1).optional(),
});

export const preservedClaimValueSchema = z.object({
  value: z.string().min(1),
  evidenceLinkIds: z.array(z.string().min(1)).default([]),
  credible: z.boolean(),
  kind: z.enum(['primary', 'contradicting', 'alternative']),
});

export type PreservedClaimValueDoc = z.infer<typeof preservedClaimValueSchema>;

export const claimVersionSchema = z.object({
  id: z.string().min(1),
  claimId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  entityId: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  temporal: claimTemporalContextSchema.optional(),
  geographic: claimGeographicContextSchema.optional(),
  proceduralStatus: z.string().min(1),
  claimClass: z.enum(['standard', 'high_impact']),
  workflowStatus: z.enum(['proposed', 'accepted', 'rejected', 'superseded']),
  publicationStatus: z.enum(['unpublished', 'published', 'retracted']),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1).optional(),
  supersedesVersionId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

/** Doc shape for `canonicalClaims/{claimId}/versions/{versionId}` (append-only subcollection). */
export type ClaimVersionDoc = z.infer<typeof claimVersionSchema>;

export const researchCoverageSchema = z.object({
  level: z.enum(['none', 'minimal', 'partial', 'substantial', 'comprehensive']),
  score: unitInterval.optional(),
  notes: z.string().optional(),
  lastCheckedAt: z.string().datetime().optional(),
});

export const relevanceMeasurementSchema = z.object({
  score: unitInterval,
  decision: z.enum(['include', 'exclude', 'supporting_context']),
  policyVersion: z.string().min(1),
  passes: z.boolean(),
});

export const connectionStrengthSchema = z.object({
  score: unitInterval,
  rationale: z.string().optional(),
});

/**
 * Canonical atomic claim parent doc: identity, current-version pointer, workflow/publication
 * status, confidence, and measurements. Versions are no longer embedded here — each is its own
 * immutable doc in the `canonicalClaims/{claimId}/versions/{versionId}` subcollection
 * (see `claimVersionSchema`), which is append-only at the Firestore rules level.
 */
export const canonicalClaimSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  predicate: z.string().min(1),
  currentVersionId: z.string().min(1),
  claimClass: z.enum(['standard', 'high_impact']),
  workflowStatus: z.enum(['proposed', 'accepted', 'rejected', 'superseded']),
  publicationStatus: z.enum(['unpublished', 'published', 'retracted']),
  proceduralStatus: z.string().min(1),
  temporal: claimTemporalContextSchema.optional(),
  geographic: claimGeographicContextSchema.optional(),
  confidence: confidenceScoreSchema.optional(),
  relevance: relevanceMeasurementSchema.optional(),
  connectionStrength: connectionStrengthSchema.optional(),
  researchCoverage: researchCoverageSchema.optional(),
  preservedValues: z.array(preservedClaimValueSchema).default([]),
  /** ISO timestamp of the last independent verification pass over this claim, if any. */
  lastVerifiedAt: z.string().datetime().optional(),
  /** Version id that was current as of the last verification pass, if any. */
  lastVerifiedVersionId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CanonicalClaimDoc = z.infer<typeof canonicalClaimSchema>;

/** Claim-to-evidence relationship (supporting contradicting contextual). */
export const claimEvidenceLinkSchema = z.object({
  id: z.string().min(1),
  claimId: z.string().min(1),
  claimVersionId: z.string().min(1),
  evidenceId: z.string().min(1),
  role: z.enum(['supporting', 'contradicting', 'contextual']),
  lineageRootId: z.string().min(1),
  credible: z.boolean(),
  sourceClassification: z.string().min(1),
  directness: unitInterval,
  temporalProximity: unitInterval,
  geographicPrecision: unitInterval,
  entityMatchQuality: unitInterval,
  extractionQuality: unitInterval,
  assertedValue: z.string().min(1).optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type ClaimEvidenceLinkDoc = z.infer<typeof claimEvidenceLinkSchema>;

// ---------------------------------------------------------------------------
// Statistics storage model (packages/domain/src/statistics/): StatisticalSeries metric
// definitions, StatisticalObservation as-reported readings (status always 'observed'), and
// DerivedMeasurement computed values (status 'derived' | 'modeled'). boundaryVersion is the
// vintage/crosswalk key generalizing the tractVintage constraint (ACS 2020s releases use 2020
// tracts, Opportunity Atlas uses 2010 tracts — never join without a crosswalk). Vocabularies
// hardcoded per this file's existing convention (see note above datePrecisionSchema).
// ---------------------------------------------------------------------------

export const statisticalGeographyTypeSchema = z.enum([
  'tract',
  'county',
  'block',
  'blockgroup',
  'address',
  'city',
  'school',
  'facility',
  'state',
]);

export const statisticalEstimateTypeSchema = z.enum([
  'count',
  'percentage',
  'rate',
  'ratio',
  'median',
  'mean',
  'index',
]);

export const statisticalPeriodTypeSchema = z.enum([
  'point-in-time',
  '1-year-estimate',
  '5-year-estimate',
  'annual',
  'decennial',
  'custom-range',
]);

export const statisticalSeriesSchema = z.object({
  metricId: z.string().min(1),
  metricDefinition: z.string().min(1),
  universe: z.string().min(1),
  unit: z.string().min(1),
  sourceDataset: z.string().min(1),
  sourceTable: z.string().min(1),
  sourceVariable: z.string().min(1),
  geographyType: statisticalGeographyTypeSchema,
  estimateType: statisticalEstimateTypeSchema,
  periodType: statisticalPeriodTypeSchema,
});

export type StatisticalSeriesDoc = z.infer<typeof statisticalSeriesSchema>;

export const statisticalObservationSchema = z.object({
  seriesId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  boundaryVersion: z.string().min(1),
  referencePeriod: z.string().min(1),
  datasetVintage: z.string().min(1),
  estimate: z.number(),
  marginOfError: z.number().optional(),
  standardError: z.number().optional(),
  numerator: z.number().optional(),
  denominator: z.number().optional(),
  sourceItemId: z.string().min(1),
  retrievedAt: z.string().datetime(),
  status: z.literal('observed'),
});

export type StatisticalObservationDoc = z.infer<typeof statisticalObservationSchema>;

export const derivedMeasurementSchema = z.object({
  methodId: z.string().min(1),
  methodVersion: z.string().min(1),
  inputObservationIds: z.array(z.string().min(1)),
  value: z.number(),
  uncertainty: z.number().optional(),
  formula: z.string().min(1),
  assumptions: z.array(z.string().min(1)).default([]),
  generatedAt: z.string().datetime(),
  status: z.enum(['derived', 'modeled']),
});

export type DerivedMeasurementDoc = z.infer<typeof derivedMeasurementSchema>;

export const contentHashSchema = z.object({
  algorithm: z.literal('sha256'),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});

export type ContentHashDoc = z.infer<typeof contentHashSchema>;

export const rightsStatusSchema = z.enum([
  'unknown',
  'public_domain',
  'licensed',
  'fair_use',
  'restricted',
  'prohibited',
]);

export const publicationPermissionSchema = z.enum([
  'cite',
  'short_excerpt',
  'substantial_excerpt',
  'display_media',
  'redistribute',
]);

export const prohibitedUseSchema = z.enum([
  'commercial_reuse',
  'full_text_republication',
  'biometric_extraction',
  'living_person_doxxing',
  'unattributed_reuse',
  'other',
]);

export const rightsPolicySchema = z.object({
  defaultStatus: rightsStatusSchema,
  publicationPermissions: z.array(publicationPermissionSchema).default([]),
  prohibitedUses: z.array(prohibitedUseSchema).default([]),
});

export type RightsPolicyDoc = z.infer<typeof rightsPolicySchema>;

export const sourceOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  homepageUrl: z.string().url().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SourceOrganizationDoc = z.infer<typeof sourceOrganizationSchema>;

export const sourceDomainSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  hostname: z.string().min(1),
  verified: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export type SourceDomainDoc = z.infer<typeof sourceDomainSchema>;

/** Registered source adapter policy (collection `evidenceSources`). */
export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  domainIds: z.array(z.string().min(1)).optional(),
  displayName: z.string().min(1),
  classification: z.string().min(1),
  adapterId: z.string().min(1),
  stableIdScheme: z.string().min(1),
  policy: z.object({
    snapshotMode: z.enum(['none', 'selective']),
    rights: rightsPolicySchema,
    permittedClaimClasses: z.array(z.string().min(1)).optional(),
    refreshSchedule: z.string().optional(),
    notes: z.string().optional(),
  }),
  /** When false, adapter cannot create new candidates. */
  adapterEnabled: z.boolean(),
  killSwitchId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EvidenceSourceDoc = z.infer<typeof evidenceSourceSchema>;

export const sourceItemSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  stableIdentifier: z.string().min(1),
  canonicalUrl: z.string().url().optional(),
  title: z.string().optional(),
  classification: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SourceItemDoc = z.infer<typeof sourceItemSchema>;

export const retrievalEventSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourceItemId: z.string().min(1).optional(),
  adapterId: z.string().min(1),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(['success', 'failure', 'skipped_disabled', 'skipped_duplicate']),
  httpStatus: z.number().int().optional(),
  error: z.string().optional(),
  parserVersion: z.string().min(1).optional(),
});

export type RetrievalEventDoc = z.infer<typeof retrievalEventSchema>;

export const sourceCaptureSchema = z.object({
  id: z.string().min(1),
  sourceItemId: z.string().min(1),
  sourceId: z.string().min(1),
  contentHash: contentHashSchema,
  parserVersion: z.string().min(1),
  retrievedAt: z.string().datetime(),
  retrievalEventId: z.string().min(1).optional(),
  snapshotStorageObject: z.string().min(1).optional(),
  snapshotMode: z.enum(['none', 'selective']),
  dedupOfCaptureId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});

export type SourceCaptureDoc = z.infer<typeof sourceCaptureSchema>;

export const evidenceLocatorSchema = z.object({
  page: z.string().optional(),
  pages: z.string().optional(),
  paragraph: z.string().optional(),
  offsetStart: z.number().int().nonnegative().optional(),
  offsetEnd: z.number().int().nonnegative().optional(),
  label: z.string().optional(),
  uriFragment: z.string().optional(),
});

export type EvidenceLocatorDoc = z.infer<typeof evidenceLocatorSchema>;

export const evidenceRecordSchema = z.object({
  id: z.string().min(1),
  /** Required: every evidence record resolves to a source item. */
  sourceItemId: z.string().min(1),
  sourceId: z.string().min(1),
  captureId: z.string().min(1).optional(),
  /** GCS Storage object reference; never embed blob bytes in Firestore. */
  storageObject: z.string().min(1).optional(),
  locator: evidenceLocatorSchema.optional(),
  excerpt: z.string().optional(),
  excerptKind: z.enum(['none', 'short', 'substantial']).default('none'),
  observedAt: z.string().optional(),
  rightsStatus: rightsStatusSchema.default('unknown'),
  publicationPermissions: z.array(publicationPermissionSchema).default([]),
  prohibitedUses: z.array(prohibitedUseSchema).default([]),
  lineageRootId: z.string().min(1).optional(),
  syndicatedFromEvidenceId: z.string().min(1).optional(),

  /**
   * @deprecated Prefer rightsStatus. Kept for transitional reads of early seeds.
 */
  rights: rightsStatusSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type EvidenceRecordDoc = z.infer<typeof evidenceRecordSchema>;

export const evidenceLineageSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['syndication', 'republication', 'derivative', 'same_capture', 'translation']),
  fromEvidenceId: z.string().min(1),
  toEvidenceId: z.string().min(1),
  lineageRootId: z.string().min(1),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type EvidenceLineageDoc = z.infer<typeof evidenceLineageSchema>;

export const publicationReleaseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['draft', 'preview', 'active', 'superseded', 'rolled_back']),
  searchIndexVersion: z.string().min(1),
  signedManifest: z.object({
    manifest: z
      .object({
        releaseId: z.string().min(1),
        searchIndexVersion: z.string().min(1),
      })
      .passthrough(),
    manifestHash: z.object({
      algorithm: z.literal('sha256'),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    signature: z.object({
      algorithm: z.literal('ecdsa-sha256'),
      keyId: z.string().min(1),
      value: z.string().min(1),
    }),
  }),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  activatedAt: z.string().datetime().optional(),
  supersededAt: z.string().datetime().optional(),
  rolledBackAt: z.string().datetime().optional(),
});

export type PublicationReleaseDoc = z.infer<typeof publicationReleaseSchema>;

export const publicActiveReleaseSchema = z.object({
  releaseId: z.string().min(1),
  activatedAt: z.string().datetime(),
  searchIndexVersion: z.string().min(1),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type PublicActiveReleaseDoc = z.infer<typeof publicActiveReleaseSchema>;

/** Accepted public claim carried inline on an entity projection (national-catalog era).
 * Non-numeric by the same standing policy as the parent schema: the projection stores the
 * display register (`confidenceLevel`), never a raw confidence score. */
export const publicClaimProjectionSchema = z.object({
  id: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  citationSource: z.string().min(1),
  citationHref: z.string().url().optional(),
  citationLabel: z.string().min(1),
});

export type PublicClaimProjectionDoc = z.infer<typeof publicClaimProjectionSchema>;

export const publicEntityProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  nameLower: z.string().min(1),
  /** Learning-index lede — required at release (120–400 chars). */
  summary: z.string().min(120).max(400),
  location: geoPointFieldsSchema.optional(),
  claimIds: z.array(z.string()).default([]),
  /** Accepted claims with citations, inline (see `publicClaimProjectionSchema`). Optional:
   * bootstrap-window stubs carry only `claimIds`; national-catalog projections carry both. */
  claims: z.array(publicClaimProjectionSchema).optional(),
  /** "City, State" jurisdiction label for cards/facets; optional on bootstrap-window stubs
   * (the web mapper falls back to bundled-seed enrichment there). */
  jurisdictionLabel: z.string().min(1).optional(),
  /** Public location description at the record's allowed precision — never a street address
   * finer than the constitution's public precision for the record. */
  locationLabel: z.string().min(1).optional(),

  /**
   * Public projection additions — every one non-numeric by standing policy (numeric
   * notability/relevance scores are banned from public payloads; see
   * packages/domain/src/relevance/notability-gate.test.ts for the enforcing test).
   */
  /** Derived current status label (e.g. "active", "in_force", "living") never a scalar the
   * reader hand-edits; always derived via @blap/domain's `currentEntityStatus`. */
  status: z.string().min(1).optional(),
  /** Decade labels the entity's dated span overlaps (e.g. ["1950s", "1960s"]) derived via
   * @blap/domain's `deriveEraBuckets`, replacing the free-text `era` string. */
  eraBuckets: z.array(z.string().min(1)).optional(),
  /** Human-readable notability rubric labels (never the raw criterion enum alone, never a
   * score) one per notabilityBasis record, sourced from @blap/domain's
   * `NOTABILITY_RUBRIC`. */
  notabilityLabels: z.array(z.string().min(1)).optional(),
  /** Sensitivity classification label when present; presentation lives in the UI layer. */
  sensitivityClass: sensitivityClassSchema.optional(),

  /**
   * @deprecated Superseded by the controlled-taxonomy split below (black-book-s4hp). Kept
   * optional, alongside the new fields, for backward compatibility during the transition —
   * new writers should populate `topicIds`/`mentionedEntityIds`/`keywords` instead. Readers
   * that still facet on this raw field must filter through
   * `@blap/domain`'s `isPermittedTopicTag` (interim allowlist); never count/facet on it
   * unfiltered.
   */
  topicTags: z.array(z.string().min(1)).default([]),
  /**
   * Controlled historical-theme ids (black-book-s4hp) — the ONLY field that may ever be
   * surfaced as a facet/filter option. Every id must resolve against
   * `@blap/domain`'s `TOPIC_REGISTRY` (packages/domain/src/taxonomy/topics.ts); readers should
   * validate with `isValidTopicId` rather than trusting this array blindly. Net-new field.
   */
  topicIds: z.array(z.string().min(1)).default([]),
  /**
   * Resolvable ids of people/places/organizations/laws/events this record mentions. Never a
   * facet — this is for future cross-linking/entity-resolution (black-book-8bck), not
   * discovery browsing. During the black-book-s4hp migration these may be raw legacy-tag
   * strings acting as placeholder ids (e.g. `"naacp"`, `"selma"`) rather than real canonical
   * entity ids; resolving those against the entity graph is black-book-8bck's job. Net-new
   * field.
   */
  mentionedEntityIds: z.array(z.string().min(1)).default([]),
  /** Free-text search-recall terms — improves query matching, never a facet. Net-new field. */
  keywords: z.array(z.string().min(1)).default([]),
  /**
   * Internal ingestion/research campaign membership (e.g. which sourcing wave produced this
   * record). Never public-facing, never a facet. Net-new field.
   */
  campaignIds: z.array(z.string().min(1)).default([]),
  /** Framing prose for the Historical context section (not unsourced biography). */
  historicalContext: z.string().min(1).optional(),
  /** Optional multi-paragraph further reading; omit when not curated. */
  extendedNarrative: z.string().min(1).optional(),
  /** Optional rights-cleared hero image; omit entirely when absent. */
  primaryImage: z
    .object({
      url: z.string().url(),
      alt: z.string().min(1),
      credit: z.string().min(1),
      rightsStatus: z.enum(['public_domain', 'licensed', 'fair_use']),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      objectPath: z.string().min(1).optional(),
    })
    .optional(),

  /**
   * Typed related entries derived from the release's graph
   * adjacency doc (`@blap/domain`'s `toPublicRelatedEntries`
   * `publicRelatedEntriesByEntityId`, packages/domain/src/graph/adjacency.ts + build.ts)
   * sufficient for "related people, places…" and "timelines" sections. Never carries a
   * numeric field beyond what's already elsewhere on this schema (evidence counts are an
   * internal ranking key on the adjacency doc, not part of this public shape).
 */
  related: z
    .array(
      z.object({
        id: z.string().min(1),
        type: relationshipTypeSchema,
        direction: z.enum(['outgoing', 'incoming']),
        timespan: z
          .object({
            label: z.string().optional(),
            validFrom: z.string().optional(),
            validTo: z.string().nullable().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export type PublicEntityProjectionDoc = z.infer<typeof publicEntityProjectionSchema>;


/**
 * persisted search index document the server-read shape @blap/domain's
 * `buildPublicSearchIndexDocs` produces (`packages/domain/src/search/`). Follows the exact
 * conventions of `publicEntityProjectionSchema` above: reuses `entityKindSchema`
 * `sensitivityClassSchema`, and every field is non-numeric BY STANDING POLICY except the two
 * counts explicitly called out below.
 *
 * `relatedCount` (connection-strength proxy) and `claimCount` are the ONLY numeric fields, and are
 * SERVER-INTERNAL ranking inputs only: search runs server-side and projects results into the
 * client-facing `SearchResultView` (defined in @blap/domain), which carries neither count
 * nor any score mirroring rule that adjacency `evidenceCount` is an ordering key, never
 * a public payload field. `notabilityBasis` is retained as the auditable inclusion basis backing
 * the AC5 gate; it carries only string leaves (criterion, note, evidenceIds the same category as
 * this file's already-public `claimIds`) and never a numeric score, and is not projected to the
 * client.
 */
export const publicSearchIndexSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  /** Lowercased displayName, precomputed for query-time matching. */
  nameLower: z.string().min(1),
  /** Lowercased alias strings, flattened from EntityAlias by the release builder. */
  aliases: z.array(z.string().min(1)).default([]),
  summary: z.string().optional(),
  /** @deprecated Superseded by `topicIds`/`mentionedEntityIds`/`keywords` below (black-book-s4hp).
   * Kept optional for backward compatibility; do not facet/count on this unfiltered. */
  topicTags: z.array(z.string().min(1)).default([]),
  /** Controlled historical-theme ids (black-book-s4hp) — the ONLY field the search-index
   * `theme` facet may be built from. Must resolve against `@blap/domain`'s `TOPIC_REGISTRY`.
   * Net-new field. */
  topicIds: z.array(z.string().min(1)).default([]),
  /** Resolvable ids of people/places/organizations/laws/events mentioned; never a facet.
   * See the identical field on `publicEntityProjectionSchema` above for the migration-window
   * placeholder-id caveat. Net-new field. */
  mentionedEntityIds: z.array(z.string().min(1)).default([]),
  /** Free-text search-recall terms; never a facet. Net-new field. */
  keywords: z.array(z.string().min(1)).default([]),
  /** Internal ingestion/research campaign membership; never public-facing, never a facet.
   * Net-new field. */
  campaignIds: z.array(z.string().min(1)).default([]),
  /** State-level jurisdiction label backs the `state` facet/filter. */
  jurisdictionState: z.string().min(1).optional(),
  /** Derived current lifecycle status label (e.g. "active", "in_force") never hand-edited. */
  status: z.string().min(1).optional(),
  /** Decade labels the entity's dated span overlaps (e.g. ["1950s", "1960s"]). */
  eraBuckets: z.array(z.string().min(1)).default([]),
  /** Auditable inclusion basis string-only leaves, never a score. */
  notabilityBasis: z
    .array(
      z.object({
        criterion: z.string().min(1),
        note: z.string().min(1),
        evidenceIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .default([]),
  /** Human-readable notability rubric labels (never the raw criterion enum alone, never a score). */
  notabilityLabels: z.array(z.string().min(1)).default([]),
  /** Sensitivity classification label when present; presentation lives in the UI layer. */
  sensitivityClass: sensitivityClassSchema.optional(),
  recordMaturity: z.string().min(1),
  researchCoverage: z.enum(['minimal', 'partial', 'substantial']),

  /**
   * SERVER-INTERNAL ranking inputs ONLY the two permitted numeric fields on this schema. Never
   * projected into the client-facing SearchResultView. `relatedCount` is a connection-strength
   * proxy (count of related/adjacency entries); `claimCount` is the supporting-claim count.
 */
  relatedCount: z.number().int().min(0),
  claimCount: z.number().int().min(0),
});

export type PublicSearchIndexDoc = z.infer<typeof publicSearchIndexSchema>;

export const submissionInboxSchema = z.object({
  status: z.literal('quarantined'),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  kind: z.enum(['correction', 'contribution', 'challenge']).optional(),
  payload: z.record(z.unknown()).optional(),
  sourceUrl: z.string().url().optional(),
});

export type SubmissionInboxDoc = z.infer<typeof submissionInboxSchema>;

export const auditActorSchema = z.object({
  id: z.string().min(1).max(256),
  type: z.enum(ACTOR_TYPES),
  displayName: z.string().min(1).max(256).optional(),
});

export const auditSubjectSchema = z.object({
  type: z.string().min(1).max(128),
  id: z.string().min(1).max(512),
  path: z.string().min(3).max(1_500),
});

export const auditEventSchema = z
  .object({
    id: z.string().min(1).max(512),
    action: z.enum(AUDIT_EVENT_ACTIONS),
    category: z.enum([
      'policy',
      'source',
      'research',
      'moderation',
      'publication',
      'correction',
      'retraction',
      'authentication',
      'administrative',
    ]),
    actor: auditActorSchema,
    subject: auditSubjectSchema,
    reason: z.string().min(1).max(2_000),
    requestId: z.string().min(1).max(512),
    correlationId: z.string().min(1).max(512),
    releaseId: z.string().min(1).max(512).optional(),
    entityId: z.string().min(1).max(512).optional(),
    idempotencyKey: z.string().min(1).max(512),
    occurredAt: z.string().datetime(),
    data: z.record(z.unknown()).optional(),
  })
  .superRefine((event, context) => {
    if (event.category !== auditCategoryFor(event.action)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: `Category must match action ${event.action}`,
      });
    }
  });

export type AuditEventDoc = z.infer<typeof auditEventSchema>;

export const outboxMessageSchema = z.object({
  id: z.string().min(1).max(512),
  eventId: z.string().min(1).max(512),
  topic: z.string().min(1).max(256),
  aggregateType: z.string().min(1).max(128),
  aggregateId: z.string().min(1).max(512),
  payload: z.record(z.unknown()),
  status: z.enum(OUTBOX_STATUSES),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive().max(100),
  availableAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  processedAt: z.string().datetime().optional(),
  lastError: z.string().min(1).max(2_000).optional(),
  correlationId: z.string().min(1).max(512),
  idempotencyKey: z.string().min(1).max(512),
});

export type OutboxMessageDoc = z.infer<typeof outboxMessageSchema>;

export const idempotencyRecordSchema = z.object({
  key: z.string().min(1).max(512),
  eventId: z.string().min(1).max(512),
  outboxMessageId: z.string().min(1).max(512),
  correlationId: z.string().min(1).max(512),
  createdAt: z.string().datetime(),
});

export type IdempotencyRecordDoc = z.infer<typeof idempotencyRecordSchema>;

export const outboxConsumerReceiptSchema = z.object({
  id: z.string().min(1).max(1_024),
  consumerId: z.string().min(1).max(256),
  messageId: z.string().min(1).max(512),
  eventId: z.string().min(1).max(512),
  processedAt: z.string().datetime(),
});

export type OutboxConsumerReceiptDoc = z.infer<typeof outboxConsumerReceiptSchema>;

export const killSwitchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  reason: z.string().optional(),
  updatedAt: z.string().datetime(),
});

export type KillSwitchDoc = z.infer<typeof killSwitchSchema>;
