
/**
 * Shared types for load, abuse, and cost simulation harnesses.
 * Scenarios exercise @blap/security guardrails locally no live endpoint attacks.
 */

/** Abuse scenario identifiers aligned with acceptance criteria. */
export type LoadAbuseScenarioId =
  | 'high_volume_static'
  | 'search_flood'
  | 'cache_busting'
  | 'geocoder_abuse'
  | 'submission_spam'
  | 'slow_clients'
  | 'oversized_payloads'
  | 'distributed_low_rate'
  | 'database_connection_exhaustion'
  | 'queue_retry_storms'
  | 'expensive_filter_combinations'
  | 'scraping_patterns';

/** Control layers that can independently deny abusive traffic. */
export type ControlLayer =
  | 'app_check'
  | 'rate_limit_token_bucket'
  | 'rate_limit_rolling_window'
  | 'rate_limit_daily_cap'
  | 'rate_limit_concurrency'
  | 'rate_limit_risk_score'
  | 'query_guardrails'
  | 'submission_validation'
  | 'submission_spam_score'
  | 'resource_scaling_cap'
  | 'resource_queue_dispatch'
  | 'resource_database_pool'
  | 'resource_daily_budget'
  | 'resource_soft_shutdown';

export type ControlDenial = {
  readonly layer: ControlLayer;
  readonly reason: string;
};

export type SimulatedRequestOutcome = {
  readonly allowed: boolean;
  readonly denials: readonly ControlDenial[];
  readonly estimatedCostUnits: number;
};

export type ScenarioStepResult = {
  readonly stepIndex: number;
  readonly outcome: SimulatedRequestOutcome;
};

export type ScenarioRunResult = {
  readonly scenarioId: LoadAbuseScenarioId;
  readonly stepsExecuted: number;
  readonly allowedCount: number;
  readonly deniedCount: number;
  readonly layersTriggered: readonly ControlLayer[];
  readonly firstDenialLayer?: ControlLayer;
  readonly totalEstimatedCostUnits: number;
  readonly publicStaticPreserved: boolean;
  readonly withinResourceCaps: boolean;
};

export type LayeredControlProof = {
  readonly scenarioId: LoadAbuseScenarioId;
  readonly layersObserved: readonly ControlLayer[];
  readonly independentLayers: number;
  readonly survivesSingleLayerBypass: boolean;
};

export type CostEstimate = {
  readonly scenarioId: LoadAbuseScenarioId;
  readonly perRequestCostUnits: number;
  readonly perRequestUsdMicros: number;
  readonly notes: string;
};

export type TuningRecommendation = {
  readonly id: string;
  readonly scenarioId: LoadAbuseScenarioId;
  readonly controlLayer: ControlLayer;
  readonly currentValue: string;
  readonly recommendedValue: string;
  readonly rationale: string;
  readonly priority: 'P0' | 'P1' | 'P2';
};

export const ALL_LOAD_ABUSE_SCENARIO_IDS: readonly LoadAbuseScenarioId[] = [
  'high_volume_static',
  'search_flood',
  'cache_busting',
  'geocoder_abuse',
  'submission_spam',
  'slow_clients',
  'oversized_payloads',
  'distributed_low_rate',
  'database_connection_exhaustion',
  'queue_retry_storms',
  'expensive_filter_combinations',
  'scraping_patterns',
] as const;
