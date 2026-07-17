/**
 * Deterministic relevance engine public surface (BB-040).
 */
export {
  RELEVANCE_ASSESSMENT_SCHEMA_VERSION,
  RELEVANCE_FIXTURE_SCHEMA_VERSION,
  RELEVANCE_DIMENSIONS,
  type RelevanceDimension,
  type RelevanceFeatureValue,
  type RelevanceGateId,
  type RelevanceGateResult,
  type RelevanceEvidenceKind,
  type RelevanceEvidence,
  type RelevanceOverride,
  type RelevanceAssessment,
  type PublicRelevanceExplanation,
  type EvaluateRelevanceInput,
  type RelevanceFixtureCase,
  type RelevanceFixture,
} from './types.js';

export {
  RELEVANCE_DIMENSION_WEIGHTS,
  extractRelevanceFeatures,
  composeCompositeScore,
  scoreDistinctiveness,
} from './dimensions.js';

export {
  computeDistinctivenessKey,
  isDuplicateOfIncluded,
  sharesContentHashWithIncluded,
  detectDuplicateCandidate,
} from './distinctiveness.js';

export {
  runRelevanceGates,
  gateFailed,
  firstFailedGate,
  buildRelevanceEvidence,
  hasIncludeEvidence,
  type RunRelevanceGatesInput,
} from './gates.js';

export {
  deriveProvisionalDecision,
  evaluateDecisionPasses,
  type ProvisionalDecisionInput,
  type ProvisionalDecisionResult,
} from './decisions.js';

export {
  buildWhyThisAppears,
  assertExplanationHasNoNumericScore,
  type BuildWhyInput,
} from './why.js';

export {
  assertOverrideReasonPresent,
  validateRelevanceOverride,
  applyRelevanceOverride,
  type ValidateOverrideInput,
} from './override.js';

export {
  toPublicRelevanceExplanation,
  assertPublicRelevanceHasNoScore,
} from './public.js';

export {
  evaluateCandidateRelevance,
  evaluateCandidateRelevanceBatch,
  type EvaluateRelevanceOptions,
} from './engine.js';

export {
  RELEVANCE_GOLD_FIXTURE_PATH,
  parseRelevanceFixture,
  loadRelevanceGoldFixture,
  getRelevanceFixtureCase,
} from './fixtures.js';
