/**
 * Zod schemas for the BlackStory product constitution.
 * Mirrors packages/schemas/constitution/product-constitution.schema.json and
 * validates the shared policy.v1.json value document.
 */
import { z } from 'zod';

const unitInterval = z.number().min(0).max(1);

export const productConstitutionSchema = z
  .object({
    policyVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    relevanceThresholds: z
      .object({
        includeMinimum: unitInterval,
        supportingContextMinimum: unitInterval,
        excludeBelow: unitInterval,
        weakSignalIndependentCeiling: unitInterval,
      })
      .strict(),
    claimConfidenceThresholds: z
      .object({
        standardPublish: unitInterval,
        highImpactPublish: unitInterval,
        disputeSurface: unitInterval,
      })
      .strict(),
    legalStatusVocabulary: z.array(z.string().min(1)).nonempty(),
    unsupportedProceduralLanguage: z.array(z.string().min(1)).nonempty(),
    recordMaturityStates: z.array(z.string().min(1)).nonempty(),
    publicPrecisionRules: z
      .object({
        allowedLevels: z.array(z.string().min(1)).nonempty(),
        prohibitedLevels: z.array(z.string().min(1)).nonempty(),
        livingResidentialProhibited: z.boolean(),
        reduceExactCoordinatesWhenNotNeeded: z.boolean(),
      })
      .strict(),
    sourceClassifications: z.array(z.string().min(1)).nonempty(),
    publicationRestrictions: z
      .object({
        requireRightsStatus: z.boolean(),
        requireAcceptedClaimAndEvidence: z.boolean(),
        blockSelfApprovingSourceAlone: z.boolean(),
        blockVolumeOnlyConfidence: z.boolean(),
        blockSyndicatedCopiesAsIndependent: z.boolean(),
        highImpactRequiresHigherThreshold: z.boolean(),
        publicLanguageCannotExceedProceduralStatus: z.boolean(),
      })
      .strict(),
    livingPersonRules: z
      .object({
        statuses: z.array(z.string().min(1)).nonempty(),
        treatUnknownAsLiving: z.boolean(),
        neverStoreResidentialAsOrdinaryPersonLocation: z.boolean(),
        neverReturnResidentialPublicly: z.boolean(),
      })
      .strict(),
    sensitivityRules: z
      .object({
        classes: z.array(z.string().min(1)).nonempty(),
        precisionReductionReasons: z.array(z.string().min(1)).nonempty(),
        residentialPrecisionLevels: z.array(z.string().min(1)).nonempty(),
        livingResidenceMaxPublicPrecision: z.string().min(1),
        occupiedPrivateResidenceMaxPublicPrecision: z.string().min(1),
        sensitiveSiteMaxPublicPrecision: z.string().min(1),
        reduceOccupiedPrivateResidenceForDeceased: z.boolean(),
      })
      .strict(),
    ugcLivingPersonRules: z
      .object({
        crossSourceProfileAggregationProhibited: z.boolean(),
        elevatedClaimClass: z.enum(['standard', 'high_impact']),
        deanonymizationProhibited: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type ProductConstitution = z.infer<typeof productConstitutionSchema>;

export const claimClassSchema = z.enum(['standard', 'high_impact']);
export type ClaimClass = z.infer<typeof claimClassSchema>;

export const relevanceDecisionSchema = z.enum(['include', 'exclude', 'supporting_context']);
export type RelevanceDecision = z.infer<typeof relevanceDecisionSchema>;

export const constitutionFixtureSchema = z
  .object({
    id: z.string().min(1),
    fixtureKind: z.enum([
      'included',
      'excluded',
      'disputed',
      'sparse',
      'sensitive',
      'living_person',
    ]),
    livingStatus: z.string().min(1),
    relevanceScore: unitInterval,
    relevanceDecision: relevanceDecisionSchema,
    claimConfidence: unitInterval,
    claimClass: claimClassSchema,
    maturity: z.string().min(1),
    publicPrecision: z.string().min(1),
    evidencePrecision: z.string().min(1).optional(),
    sourceClassification: z.string().min(1),
    proceduralStatus: z.string().min(1),
    narrativeSnippet: z.string().min(1),
    publicationBlocked: z.boolean(),
    exclusionReason: z.string().min(1).optional(),
    disputePresent: z.boolean().optional(),
    researchCoverage: z.string().min(1).optional(),
    sensitivityClass: z.string().min(1).optional(),
  })
  .strict();

export type ConstitutionFixture = z.infer<typeof constitutionFixtureSchema>;
