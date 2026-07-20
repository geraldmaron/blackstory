/**
 * Claims, contradictions, and confidence model surface.
 */
export { asClaimId, asClaimVersionId, asClaimEvidenceLinkId } from './ids.js';
export type { ClaimId, ClaimVersionId, ClaimEvidenceLinkId } from './ids.js';

export {
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
} from './claim.js';
export type {
  ClaimWorkflowStatus,
  ClaimPublicationStatus,
  ClaimGeographicContext,
  ClaimVersion,
  CanonicalClaim,
  PreservedClaimValue,
} from './claim.js';

export {
  CLAIM_EVIDENCE_ROLES,
  isClaimEvidenceRole,
  assertClaimEvidenceLinkValid,
  linksForRole,
} from './evidence-link.js';
export type { ClaimEvidenceRole, ClaimEvidenceLink } from './evidence-link.js';

export {
  CONFIDENCE_COMPONENT_WEIGHTS,
  sourceAuthorityForClassification,
  lineageIndependenceFromCount,
  uniqueLineageAggregates,
  calculateClaimConfidence,
} from './confidence.js';
export type {
  ConfidenceComponents,
  ConfidenceScore,
  ConfidenceEngineInput,
  ConfidenceEngineResult,
} from './confidence.js';

export {
  RESEARCH_COVERAGE_LEVELS,
  isResearchCoverageLevel,
  assertResearchCoverageLevel,
  assertUnitInterval,
  measureRelevance,
  measureConnectionStrength,
  defaultResearchCoverage,
} from './measurements.js';
export type {
  ResearchCoverageLevel,
  ResearchCoverage,
  RelevanceMeasurement,
  ConnectionStrengthMeasurement,
} from './measurements.js';

export { preserveContradictoryValues, assertContradictionsPreserved } from './contradictions.js';
export type { ContradictionSet } from './contradictions.js';

export {
  evaluatePublicationThreshold,
  highImpactUsesHigherThreshold,
  assertHighImpactThresholdHigher,
  assertNarrativeMayCiteClaim,
  narrativeMayCiteClaim,
  assertClaimMayPublish,
} from './publication.js';
export type { PublicationThresholdResult } from './publication.js';
