/**
 * Firestore document schemas for Black Book (ADR-011 / BB-013 foundation, BB-014 domain depth).
 * Shapes align with @black-book/domain; Cloud SQL / PostGIS are not the production path.
 */
import { z } from 'zod';

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

export const evidenceRecordSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  /** GCS / Storage object reference; never embed blob bytes in Firestore. */
  storageObject: z.string().min(1),
  rights: z.enum(['unknown', 'public_domain', 'licensed', 'restricted']).default('unknown'),
  createdAt: z.string().datetime(),
});

export type EvidenceRecordDoc = z.infer<typeof evidenceRecordSchema>;

export const publicationReleaseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['draft', 'signed', 'active', 'retired']),
  manifestHash: z.string().min(1),
  searchIndexVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  activatedAt: z.string().datetime().optional(),
});

export type PublicationReleaseDoc = z.infer<typeof publicationReleaseSchema>;

export const publicActiveReleaseSchema = z.object({
  releaseId: z.string().min(1),
  activatedAt: z.string().datetime(),
  searchIndexVersion: z.string().min(1),
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

export const auditEventSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  actor: z.string().min(1),
  resource: z.string().min(1),
  at: z.string().datetime(),
  detail: z.record(z.unknown()).optional(),
});

export type AuditEventDoc = z.infer<typeof auditEventSchema>;

export const killSwitchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  reason: z.string().optional(),
  updatedAt: z.string().datetime(),
});

export type KillSwitchDoc = z.infer<typeof killSwitchSchema>;
