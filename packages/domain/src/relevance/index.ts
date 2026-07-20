/**
 * Deterministic relevance engine public surface.
 */
export {
  RELEVANCE_ASSESSMENT_SCHEMA_VERSION,
  RELEVANCE_FIXTURE_SCHEMA_VERSION,
  RELEVANCE_DIMENSIONS,
  RELEVANCE_GATE_IDS,
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
  evaluateNotabilityGate,
  assertPublishableEntityHasNotabilityBasis,
} from './notability-gate.js';

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

export { toPublicRelevanceExplanation, assertPublicRelevanceHasNoScore } from './public.js';

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

// public "why this appears" surface story-dimension balance, editorial euphemism
// checks, trauma-content notices, missing-perspective indicators, and the auditable
// notabilityBasis renderer. Composes ./why.js, ./public.js, and ../entity-status.js; introduces
// no new relevance gate and does not modify ./engine.js or ./gates.js.
export {
  STORY_DIMENSIONS,
  STORY_DIMENSION_LABELS,
  classifyStoryDimensions,
  isViolenceOnlyCollapse,
  assertResultsNotViolenceOnlyCollapse,
  type StoryDimension,
} from './why-public-dimensions.js';

export {
  PASSIVE_EUPHEMISM_PHRASES,
  findPassiveEuphemisms,
  assertNoPassiveEuphemisms,
  type PassiveEuphemismPhrase,
  type EditorialFinding,
} from './why-public-editorial.js';

export {
  deriveTraumaContentNotice,
  type TraumaContentNoticeDecision,
} from './why-public-notice.js';

export {
  deriveMissingPerspectiveIndicators,
  type MissingPerspectiveIndicator,
} from './why-public-missing-perspective.js';

export {
  NOTABILITY_CRITERION_LABELS,
  buildPublicNotabilityBasis,
  assertPublicNotabilityBasisNeverScored,
  type PublicNotabilityBasisItem,
} from './why-public-basis.js';

export {
  assertSubstantiveConnectionExplained,
  assertReasonNotIdentityAttendanceOrJobAlone,
  assertExplanationDerivesFromAcceptedEvidence,
  buildPublicWhyThisAppears,
  type PublicWhyThisAppearsInput,
  type PublicWhyThisAppears,
} from './why-public-explanation.js';
