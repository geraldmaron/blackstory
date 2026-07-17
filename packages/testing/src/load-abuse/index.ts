
/**
 * Public exports for load, abuse, and cost simulation harnesses.
 */
export {
  createLoadAbuseHarness,
  cacheKeyCollapsesVariants,
  buildCacheKeyFromQuery,
  aggregateDistributedLowRate,
  summarizeScenario,
  proveLayeredControls,
  assertPublicServingUnderBudgetPressure,
} from './harness.js';
export type {
  LoadAbuseHarnessOptions,
  RateLimitSimInput,
  SearchSimInput,
  SubmissionSimInput,
} from './harness.js';

export {
  runHighVolumeStaticScenario,
  runSearchFloodScenario,
  runCacheBustingScenario,
  runGeocoderAbuseScenario,
  runSubmissionSpamScenario,
  runSlowClientsScenario,
  runOversizedPayloadsScenario,
  runDistributedLowRateScenario,
  runDatabaseConnectionExhaustionScenario,
  runQueueRetryStormsScenario,
  runExpensiveFilterCombinationsScenario,
  runScrapingPatternsScenario,
  runAllLoadAbuseScenarios,
} from './scenarios.js';
export type { ScenarioRunner } from './scenarios.js';

export { estimateScenarioCosts, getCostEstimateForScenario } from './cost-model.js';

export { loadAbuseTuningRecommendations, tuningRecommendationsByPriority } from './tuning.js';

export {
  ALL_LOAD_ABUSE_SCENARIO_IDS,
} from './types.js';
export type {
  LoadAbuseScenarioId,
  ControlLayer,
  ControlDenial,
  SimulatedRequestOutcome,
  ScenarioStepResult,
  ScenarioRunResult,
  LayeredControlProof,
  CostEstimate,
  TuningRecommendation,
} from './types.js';
