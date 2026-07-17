/**
 * Editorial trust domain surface (BB-088) — local barrel pending merge into `../index.ts`.
 */
export {
  ERRATA_CHANGE_TYPES,
  ERRATA_CHANGE_TYPE_LABELS,
  errataTypeFromFactRevisionChangeType,
  isErrataChangeType,
  type ErrataChangeType,
} from './errata-taxonomy.js';

export {
  TRUST_PROJECT_INDICATORS,
  IFCN_COMMITMENTS,
  PREBUNK_TECHNIQUE_FRAMES,
  type TrustProjectIndicator,
  type IfcnCommitment,
} from './trust-vocabulary.js';

export {
  FACT_STATUS_LIFECYCLE_DEFINITIONS,
  ENTITY_STATUS_VOCABULARY,
  SOURCE_HIERARCHY_LEVELS,
  assertFactStatusDefinitionsComplete,
} from './methodology-definitions.js';

export {
  CLAIM_REVIEW_ALLOWED_PATH_PREFIX,
  assertClaimReviewPathExclusive,
  buildNewsMediaOrganizationJsonLd,
  buildPublishingPrinciplesJsonLd,
  buildMythClaimReviewJsonLd,
  buildErrataCorrectionJsonLd,
  type TrustSiteIdentity,
  type NewsMediaOrganizationJsonLdInput,
  type PublishingPrinciplesJsonLdInput,
  type MythClaimReviewInput,
} from './jsonld.js';
