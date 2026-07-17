/**
 * Firestore document schemas for Black Book (ADR-011 / BB-013–018).
 * Entity/geography (BB-014), provenance (BB-016), claims/confidence (BB-017).
 * Shapes align with @black-book/domain; Cloud SQL / PostGIS are not the production path.
 */
import { z } from 'zod';
import {
  ACTOR_TYPES,
  AUDIT_EVENT_ACTIONS,
  OUTBOX_STATUSES,
  auditCategoryFor,
} from '@black-book/domain';

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
  /** ZIP is modern input/lookup only — never a historical boundary. */
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
  statusHistory: z
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CanonicalEntityDoc = z.infer<typeof canonicalEntitySchema>;

export const entityRelationshipSchema = z.object({
  id: z.string().min(1),
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
  type: z.enum([
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
    'other',
  ]),
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
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

const unitInterval = z.number().min(0).max(1);

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

/** Canonical atomic claim with versions, confidence, and measurements (BB-017). */
export const canonicalClaimSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  predicate: z.string().min(1),
  currentVersionId: z.string().min(1),
  versions: z.array(claimVersionSchema).min(1),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CanonicalClaimDoc = z.infer<typeof canonicalClaimSchema>;

/** Claim-to-evidence relationship (supporting / contradicting / contextual). */
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

/** Registered source adapter / policy (collection `evidenceSources`). */
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
  /** When false, adapter cannot create new candidates (BB-016). */
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
  /** Required: every evidence record resolves to a source item (BB-016). */
  sourceItemId: z.string().min(1),
  sourceId: z.string().min(1),
  captureId: z.string().min(1).optional(),
  /** GCS / Storage object reference; never embed blob bytes in Firestore. */
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
   * @deprecated Prefer rightsStatus. Kept for transitional reads of early BB-013 seeds.
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

export const publicEntityProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  nameLower: z.string().min(1),
  summary: z.string().optional(),
  location: geoPointFieldsSchema.optional(),
  claimIds: z.array(z.string()).default([]),
});

export type PublicEntityProjectionDoc = z.infer<typeof publicEntityProjectionSchema>;

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
