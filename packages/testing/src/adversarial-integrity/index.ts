
/**
 * Public exports for adversarial integrity exercise harnesses.
 */
export {
  summarizeAdversarialScenario,
  provePublicContentIsolation,
  proveLineageVolumeDefense,
  provePublicLanguageDefense,
  DOCUMENTED_CONTROL_GAPS,
} from './harness.js';
export type { AdversarialHarnessStep } from './harness.js';

export {
  BASE_NOW_ISO,
  BASE_NOW_MS,
  claimEvidenceLink,
  promotionClaim,
  promotionEvidence,
  submissionContext,
} from './fixtures.js';

export {
  runFalseSourceSubmissionsScenario,
  runSourceLaunderingScenario,
  runCoordinatedCitationRepetitionScenario,
  runAlteredDocumentsScenario,
  runMisidentifiedPeopleScenario,
  runLivingAddressAttemptsScenario,
  runProceduralStatusInflationScenario,
  runRaceInferenceScenario,
  runRelevanceGamingScenario,
  runModeratorSocialEngineeringScenario,
  runUnauthorizedPublicationScenario,
  runAllAdversarialIntegrityScenarios,
} from './scenarios.js';

export {
  ALL_ADVERSARIAL_INTEGRITY_SCENARIO_IDS,
} from './types.js';
export type {
  AdversarialIntegrityScenarioId,
  AdversarialIntegritySummary,
  AdversarialScenarioRunResult,
  IntegrityControlLayer,
  IntegrityControlProof,
} from './types.js';
