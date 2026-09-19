/**
 * Canonical public release projection contracts.
 *
 * These schemas describe Postgres-backed release payloads and portable release artifacts.
 * They intentionally live outside every storage adapter so web, workers, and migration tools
 * validate the same wire shape without importing a database client.
 */
import { z } from 'zod';
import { relationshipTypeSchema } from './relationship-vocabulary.js';
import { parseWaybackCaptureUrl } from './archive-pointer.js';

/**
 * Mirrors ThemeImpactThemeId / THEME_IMPACT_THEME_IDS from
 * packages/domain/src/statistics/theme-impact-questions.ts. Kept as a local literal
 * (not imported) so schemas does not take a reverse dependency on @repo/domain — see
 * banned-books.ts for the same pattern. Keep this list in sync with that file.
 */
const THEME_IMPACT_THEME_IDS_MIRROR = [
  'redlining',
  'drug_policy_state',
  'urban_renewal',
  'mass_incarceration',
  'environmental_racism',
  'school_segregation',
  'voting_rights',
  'wealth_gap',
  'cross_cutting',
] as const;

const themeImpactThemeIdSchema = z.enum(THEME_IMPACT_THEME_IDS_MIRROR);

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
  // A technology or process, not an artifact. Must stay in lockstep with ENTITY_KINDS.
  'invention',
  'other',
]);

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geohash: z.string().min(1).max(12),
  geohashPrefixes: z.array(z.string().min(1)).max(12).optional(),
  precision: z.string().min(1).optional(),
  matchMethod: z.string().min(1).optional(),
  /**
   * Set when reducePublicPrecision coarsens the location. Reason vocabulary is defined in
   * docs/security/location-precision-standard.md.
   */
  precisionReductionReason: z.string().min(1).optional(),
});

/**
 * Reader-facing visit information, present only when publicVisitForTier permits fields for the
 * entity kind, living status and location precision.
 */
const publicVisitAddressSchema = z.object({
  street: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  /** Pre-composed single-line address, when the source material only offers one string. */
  line: z.string().min(1).optional(),
});

const publicVisitPhoneSchema = z.object({
  e164: z.string().min(1),
  display: z.string().min(1),
});

const publicVisitSchema = z.object({
  address: publicVisitAddressSchema.optional(),
  phone: publicVisitPhoneSchema.optional(),
  website: z.string().url().optional(),
  hours: z.string().min(1).optional(),
  visitability: z
    .enum(['open_to_public', 'exterior_only', 'private', 'demolished', 'unknown'])
    .optional(),
  /** Claim ids or evidence ids the visit fields rest on. */
  sources: z.array(z.string().min(1)).optional(),
});
export type PublicVisitDoc = z.infer<typeof publicVisitSchema>;

const statusHistoryEntrySchema = z.object({
  status: z.string().min(1),
  validFrom: z.string().optional(),
  validTo: z.string().nullable().optional(),
  datePrecision: z.enum(['day', 'month', 'year', 'decade', 'circa']),
  basisClaimIds: z.array(z.string().min(1)).default([]),
});

/**
 * Mirrors NOTABILITY_CRITERIA in `packages/domain/src/entity-status.ts`, restated here because
 * @repo/schemas depends on nothing but zod. `documented_contribution` is the invention basis: an
 * invention is not a site, and `documented_site` was the honest-but-wrong fallback it inherited.
 *
 * Read the `.catch` on the ARRAY below before adding a value here.
 */
const notabilityBasisRecordSchema = z.object({
  criterion: z.enum([
    'first_to_do_x',
    'major_honor_or_hall_of_fame',
    'landmark_or_national_register',
    'court_precedent',
    'movement_significance',
    'documented_site',
    'documented_contribution',
    'documented_racial_terror',
    'documented_racial_killing',
    'community_anchor',
    'only_or_oldest',
    'enacted_law',
    'elected_or_appointed_office',
    'black_press_or_archive',
    'documented_military_service',
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

export const publicActiveReleaseSchema = z.object({
  releaseId: z.string().min(1),
  activatedAt: z.string().datetime(),
  searchIndexVersion: z.string().min(1),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PublicActiveReleaseDoc = z.infer<typeof publicActiveReleaseSchema>;

export const publicClaimProjectionSchema = z
  .object({
    id: z.string().min(1),
    predicate: z.string().min(1),
    object: z.string().min(1),
    confidenceLevel: z.enum(['high', 'medium', 'low']),
    citationSource: z.string().min(1),
    citationHref: z.string().url().optional(),
    archivedUrl: z.string().url().optional(),
    archivedAt: z.string().datetime().optional(),
    citationLabel: z.string().min(1),
    independentLineageCount: z.number().int().nonnegative().optional(),
    /**
     * Whether the claim describes an index row or evidence about its subject. When unspecified,
     * record-tier classification uses the predicate.
     */
    claimRole: z.enum(['record_index', 'evidence']).optional(),
  })
  .superRefine((claim, context) => {
    if ((claim.archivedUrl === undefined) !== (claim.archivedAt === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'archivedUrl and archivedAt must be published together',
      });
    }
    if (claim.archivedUrl !== undefined && claim.citationHref === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'an archived citation must retain citationHref as its original source',
      });
    }
    if (
      claim.archivedUrl !== undefined &&
      claim.archivedAt !== undefined &&
      claim.citationHref !== undefined
    ) {
      const pointer = parseWaybackCaptureUrl(claim.archivedUrl, claim.citationHref);
      if (pointer === null || pointer.capturedAt !== claim.archivedAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'archive pointer must be a timestamp-matched Wayback copy of citationHref',
        });
      }
    }
  });
export type PublicClaimProjectionDoc = z.infer<typeof publicClaimProjectionSchema>;

export const publicEntityProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: entityKindSchema,
  displayName: z.string().min(1),
  nameLower: z.string().min(1),
  /**
   * Summary length matches the public wire contract's 5,000-character ceiling; the
   * 120-character floor rejects stubs. Shorter card prose belongs in editorial checks rather
   * than a stricter read parser that would hide already published records.
   */
  summary: z.string().min(120).max(5000),
  location: geoPointSchema.optional(),
  visit: publicVisitSchema.optional(),
  claimIds: z.array(z.string()).default([]),
  claims: z.array(publicClaimProjectionSchema).optional(),
  jurisdictionLabel: z.string().min(1).optional(),
  locationLabel: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  statusHistory: z.array(statusHistoryEntrySchema).optional(),
  /**
   * Include presumed_deceased in the living-status vocabulary. deriveLivingStatus can infer it
   * from the age bound without a sourced death year; keep that distinction visible and apply
   * the shared privacy policy.
   */
  livingStatus: z.enum(['living', 'deceased', 'presumed_deceased', 'unknown']).optional(),
  statusProvenance: z.enum(['canonical', 'derived_heuristic']).optional(),
  eraBuckets: z.array(z.string().min(1)).optional(),
  notabilityLabels: z.array(z.string().min(1)).optional(),
  /**
   * If an inclusion-basis criterion cannot be parsed, omit the basis array rather than hide the
   * entire record or silently relabel the criterion. This degradation loses the reason block
   * and must not imply the underlying evidence was verified.
   */
  notabilityBasis: z.array(notabilityBasisRecordSchema).catch([]).optional(),
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
  /**
   * Explicit impact-on-Black-Americans statement (content-expectations spec: required for
   * law/case kinds). Also woven into historicalContext prose; this field is the
   * machine-checkable copy the audit evaluator reads.
   */
  impactStatement: z.string().min(1).optional(),
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
      /**
       * Identify source-hosted images fetched by the reader's browser. sourceSystem, fileTitle
       * and sha1 identify the upstream version for drift checks; sourcePageUrl supplies
       * attribution. license is the specific license identifier, separate from the coarse
       * rightsStatus category. No schedule is implied.
       */
      sourceSystem: z.enum(['wikimedia_commons', 'nps', 'loc', 'public_media']).optional(),
      fileTitle: z.string().min(1).optional(),
      sha1: z.string().min(1).optional(),
      sourcePageUrl: z.string().url().optional(),
      license: z.string().min(1).optional(),
      pinnedAt: z.string().min(1).optional(),
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

/**
 * Anchors a theme-impact packet's data moment (observation/derived/artifact) to a
 * point within a story body section. Additive/optional — projection layer only,
 * does not change how sections are assembled or rendered by default.
 */
export const publicStorySectionMomentSchema = z.object({
  packetId: z.string().min(1),
  kind: z.enum(['observation', 'artifact', 'derived', 'timeline', 'map']),
  refId: z.string().min(1),
  placement: z.enum(['after']),
});
export type PublicStorySectionMomentDoc = z.infer<typeof publicStorySectionMomentSchema>;

/** One side of a two-source dispute surfaced within a story body section. */
export const publicStorySectionDisputeSideSchema = z.object({
  sourceLabel: z.string().min(1),
  claim: z.string().min(1),
});
export type PublicStorySectionDisputeSideDoc = z.infer<typeof publicStorySectionDisputeSideSchema>;

export const publicStorySectionDisputeSchema = z.object({
  label: z.string().min(1),
  sideA: publicStorySectionDisputeSideSchema,
  sideB: publicStorySectionDisputeSideSchema,
});
export type PublicStorySectionDisputeDoc = z.infer<typeof publicStorySectionDisputeSchema>;

export const publicStorySectionSchema = z.object({
  heading: z.string().min(1).optional(),
  paragraphs: z.array(z.string().min(1)).min(1),
  moments: z.array(publicStorySectionMomentSchema).optional(),
  disputes: z.array(publicStorySectionDisputeSchema).optional(),
});
export type PublicStorySectionDoc = z.infer<typeof publicStorySectionSchema>;

export const publicStorySourceSchema = z.object({
  label: z.string().min(1).max(200),
  url: z.string().url().max(2048),
});
export type PublicStorySourceDoc = z.infer<typeof publicStorySourceSchema>;

/**
 * Binds a story to a themeId (mirrors ThemeImpactThemeId — see
 * THEME_IMPACT_THEME_IDS_MIRROR above) as one chapter of a multi-story theme arc.
 * Projection-layer only: does not merge or reorder stories in any pipeline.
 */
export const publicStoryThemeBindingSchema = z.object({
  themeId: themeImpactThemeIdSchema,
  chapterIndex: z.number().int().positive(),
  chapterCount: z.number().int().positive(),
});
export type PublicStoryThemeBindingDoc = z.infer<typeof publicStoryThemeBindingSchema>;

/**
 * Longform fixture shape used by the admin cover-package catalog and public-story-seed. Public
 * /stories reads articles. Retire this shape with its fixture consumers when the admin catalog
 * uses real article records.
 */
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
  themeBinding: publicStoryThemeBindingSchema.optional(),
});
export type PublicStoryProjectionDoc = z.infer<typeof publicStoryProjectionSchema>;

/**
 * The cached grading inputs, mirroring `RecordEvidenceInputs` in
 * `@repo/public-contracts/evidence` and `@repo/domain`'s projection. The reader hands a parsed
 * value straight to `confidenceTierFromEvidenceInputs`, so the field names here are load-bearing.
 */
export const recordEvidenceInputsSchema = z.object({
  strongestClaimLevel: z.enum(['high', 'medium', 'low', 'unrated']),
  citedLineageKeys: z.array(z.string().min(1)).default([]),
  evidenceLineageKeys: z.array(z.string().min(1)).default([]),
});
export type RecordEvidenceInputsDoc = z.infer<typeof recordEvidenceInputsSchema>;

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
  /**
   * Cache evidence-grading inputs, not the resulting tier. The reader applies the shared rule
   * to strongest claim level and lineage keys. An absent projection requires hydration; an
   * explicitly empty projection grades unrated.
   */
  evidenceInputs: recordEvidenceInputsSchema.optional(),
  /** Present when the search row carries a public geohash (mappable signal for Records). */
  geohash: z.string().min(1).optional(),
});
export type PublicSearchProjectionDoc = z.infer<typeof publicSearchProjectionSchema>;

/**
 * Frozen ThemeImpactPacket projection payload — one row per packet in
 * `published.release_theme_impact_packets.payload`. The payload is the packet
 * document exactly as authored in `reference.theme_impact_packets` at
 * promotion time; the domain parser (`parseThemeImpactPacketRow`) remains the
 * deep validator. This schema pins only the envelope fields the read path and
 * projection step key on, so schemas keeps no reverse dependency on domain.
 */
export const publicThemeImpactPacketProjectionSchema = z.object({
  id: z.string().min(1),
  themeId: themeImpactThemeIdSchema,
  questionId: z.string().regex(/^Q\d+$/),
  status: z.literal('published'),
});
export type PublicThemeImpactPacketProjectionDoc = z.infer<
  typeof publicThemeImpactPacketProjectionSchema
>;
