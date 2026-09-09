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
  BRIDGE_LINEAGE_KEY,
  SOURCE_LINEAGE_KINDS,
  authorityForHost,
  isSameLineage,
  resolveSourceLineage,
  sourceLineageKey,
} from './lineage.js';
export type { SourceLineage, SourceLineageInput, SourceLineageKind } from './lineage.js';

export {
  ASSERTION_CLASSES,
  FITNESS_LEVELS,
  HIGH_IMPACT_ASSERTION_CLASSES,
  SOURCE_CLASSES,
  assessSourceFitness,
  isAssertionClass,
  isBridgeSourceClass,
  isHighImpactAssertion,
  isSourceClass,
  isUnfitFor,
  sourceAuthorityForFitness,
} from './source-fitness.js';
export type { AssertionClass, Fitness, FitnessAssessment, SourceClass } from './source-fitness.js';

export {
  BOUNDED_ATTRIBUTION_TERMS,
  BROAD_ATTRIBUTION_TERMS,
  COMMERCIAL_TERMS,
  IMPACT_TERMS,
  SUPERLATIVE_TERMS,
  assertionClassesInText,
  boundedAlternativesFor,
  checkAttribution,
  checkCommunityIdentityEvidence,
  findAttributionMarkers,
  highImpactAssertionsInText,
  makesBroadAttribution,
  makesSuperlativeClaim,
  patentTitleSuggestsImprovement,
} from './attribution.js';
export type {
  AttributionCheckInput,
  AttributionFinding,
  AttributionMarker,
} from './attribution.js';

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
