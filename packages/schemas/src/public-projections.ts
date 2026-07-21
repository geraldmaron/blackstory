/**
 * Canonical public release projection contracts.
 *
 * These schemas describe Postgres-backed release payloads and portable release artifacts.
 * They intentionally live outside every storage adapter so web, workers, and migration tools
 * validate the same wire shape without importing Firebase or a database client.
 */
import { z } from 'zod';

const entityKindSchema = z.enum([
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
  'movement',
  'other',
]);

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geohash: z.string().min(1).max(12),
  geohashPrefixes: z.array(z.string().min(1)).max(12).optional(),
  precision: z.string().min(1).optional(),
  matchMethod: z.string().min(1).optional(),
});

const statusHistoryEntrySchema = z.object({
  status: z.string().min(1),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  datePrecision: z.enum(['day', 'month', 'year', 'decade', 'circa']),
  basisClaimIds: z.array(z.string().min(1)).default([]),
});

const notabilityBasisRecordSchema = z.object({
  criterion: z.enum([
    'first_to_do_x',
    'major_honor_or_hall_of_fame',
    'landmark_or_national_register',
    'court_precedent',
    'movement_significance',
    'documented_site',
    'community_anchor',
    'only_or_oldest',
  ]),
  note: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
});

const sensitivityClassSchema = z.enum([
  'contested_legacy',
  'perpetrator_associated',
  'violence_associated',
  'enslaver_or_segregationist',
]);

const relationshipTypeSchema = z.enum([
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

export const publicActiveReleaseSchema = z.object({
  releaseId: z.string().min(1),
  activatedAt: z.string().datetime(),
  searchIndexVersion: z.string().min(1),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PublicActiveReleaseDoc = z.infer<typeof publicActiveReleaseSchema>;

export const publicClaimProjectionSchema = z.object({
  id: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  citationSource: z.string().min(1),
  citationHref: z.string().url().optional(),
  citationLabel: z.string().min(1),
  independentLineageCount: z.number().int().nonnegative().optional(),
});
export type PublicClaimProjectionDoc = z.infer<typeof publicClaimProjectionSchema>;

export const publicEntityProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  nameLower: z.string().min(1),
  summary: z.string().min(120).max(400),
  location: geoPointSchema.optional(),
  claimIds: z.array(z.string()).default([]),
  claims: z.array(publicClaimProjectionSchema).optional(),
  jurisdictionLabel: z.string().min(1).optional(),
  locationLabel: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  statusHistory: z.array(statusHistoryEntrySchema).optional(),
  eraBuckets: z.array(z.string().min(1)).optional(),
  notabilityLabels: z.array(z.string().min(1)).optional(),
  notabilityBasis: z.array(notabilityBasisRecordSchema).optional(),
  researchCoverage: z.enum(['minimal', 'partial', 'substantial']).optional(),
  generatedAt: z.string().datetime().optional(),
  recordUpdatedAt: z.string().datetime().optional(),
  sensitivityClass: sensitivityClassSchema.optional(),
  topicTags: z.array(z.string().min(1)).default([]),
  topicIds: z.array(z.string().min(1)).default([]),
  mentionedEntityIds: z.array(z.string().min(1)).default([]),
  keywords: z.array(z.string().min(1)).default([]),
  campaignIds: z.array(z.string().min(1)).default([]),
  historicalContext: z.string().min(1).optional(),
  extendedNarrative: z.string().min(1).optional(),
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

export const publicStorySectionSchema = z.object({
  heading: z.string().min(1).optional(),
  paragraphs: z.array(z.string().min(1)).min(1),
});
export type PublicStorySectionDoc = z.infer<typeof publicStorySectionSchema>;

export const publicStorySourceSchema = z.object({
  label: z.string().min(1).max(200),
  url: z.string().url().max(2048),
});
export type PublicStorySourceDoc = z.infer<typeof publicStorySourceSchema>;

export const publicStoryProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(160),
  dek: z.string().min(1).max(400),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eraLabel: z.string().min(1).max(80),
  placeLabel: z.string().min(1).max(120),
  body: z.array(publicStorySectionSchema).min(1),
  relatedEntityIds: z.array(z.string().min(1)).min(1),
  sources: z.array(publicStorySourceSchema).min(1),
});
export type PublicStoryProjectionDoc = z.infer<typeof publicStoryProjectionSchema>;

export const publicStoryListItemSchema = publicStoryProjectionSchema.omit({
  body: true,
  relatedEntityIds: true,
  sources: true,
});
export type PublicStoryListItemDoc = z.infer<typeof publicStoryListItemSchema>;

export const publicSearchProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  nameLower: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  summary: z.string().optional(),
  topicTags: z.array(z.string().min(1)).default([]),
  topicIds: z.array(z.string().min(1)).default([]),
  mentionedEntityIds: z.array(z.string().min(1)).default([]),
  keywords: z.array(z.string().min(1)).default([]),
  campaignIds: z.array(z.string().min(1)).default([]),
  jurisdictionState: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  eraBuckets: z.array(z.string().min(1)).default([]),
  notabilityBasis: z.array(notabilityBasisRecordSchema).default([]),
  notabilityLabels: z.array(z.string().min(1)).default([]),
  sensitivityClass: sensitivityClassSchema.optional(),
  recordMaturity: z.string().min(1),
  researchCoverage: z.enum(['minimal', 'partial', 'substantial']),
  relatedCount: z.number().int().min(0),
  claimCount: z.number().int().min(0),
});
export type PublicSearchProjectionDoc = z.infer<typeof publicSearchProjectionSchema>;
