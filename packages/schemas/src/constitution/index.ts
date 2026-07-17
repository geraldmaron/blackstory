/**
 * Public surface for the machine-readable product constitution.
 * Exports are intentionally read-only: loaders and evaluators only.
 * Do not add mutation, update, or remote-write APIs here policy is not
 * changeable through public endpoints.
 */
export {
  claimClassSchema,
  constitutionFixtureSchema,
  productConstitutionSchema,
  relevanceDecisionSchema,
  type ClaimClass,
  type ConstitutionFixture,
  type ProductConstitution,
  type RelevanceDecision,
} from './schema.js';

export {
  CONSTITUTION_DIR,
  CONSTITUTION_SCHEMA_PATH,
  FIXTURES_DIR,
  POLICY_V1_PATH,
  getPolicyVersion,
  loadAllConstitutionFixtures,
  loadConstitutionFixture,
  loadProductConstitution,
  resetProductConstitutionCache,
  type FixtureKind,
} from './load.js';

export {
  evaluateClaimConfidence,
  evaluateLivingStatus,
  evaluateProceduralLanguage,
  evaluatePublicPrecision,
  evaluateRelevance,
  isRecognizedVocabulary,
  type PolicyEvaluation,
} from './evaluate.js';
