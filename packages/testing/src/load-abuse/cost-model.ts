
/**
 * Deterministic cost-per-abusive-request estimates.
 * Uses policy metadata from /026/033 not live billing data.
 */
import {
  DEFAULT_DAILY_BUDGETS,
  DEFAULT_ENDPOINT_QUOTA_MATRIX,
  DEFAULT_QUERY_GUARDRAIL_LIMITS,
  estimateQueryCost,
  resolveEndpointPolicy,
  type CanonicalSearchQuery,
  type SearchFilterField,
} from '@blap/security';
import type { CostEstimate, LoadAbuseScenarioId } from './types.js';

/** Rough micro-USD per cost unit for documentation (not authoritative billing). */
const MICRO_USD_PER_COST_UNIT = 0.05;

function microUsd(units: number): number {
  return Math.round(units * MICRO_USD_PER_COST_UNIT * 1_000) / 1_000;
}

const BASELINE_SEARCH: CanonicalSearchQuery = {
  q: 'historical archive',
  filters: [],
  sort: 'relevance',
  pageSize: 20,
  depth: 1,
  shape: 'text',
};

const EXPENSIVE_FILTER_COMBO: CanonicalSearchQuery = {
  ...BASELINE_SEARCH,
  filters: [
    { field: 'kind' as SearchFilterField, value: 'person' },
    { field: 'state' as SearchFilterField, value: 'published' },
    { field: 'precision' as SearchFilterField, value: 'city' },
    { field: 'status' as SearchFilterField, value: 'verified' },
    { field: 'era' as SearchFilterField, value: 'civil-rights' },
  ],
  sort: 'distance',
  geo: { lat: 38.9, lng: -77.0, radiusM: 50_000 },
  shape: 'text_geo_filters',
};

const expensiveComboCost = estimateQueryCost(EXPENSIVE_FILTER_COMBO, DEFAULT_QUERY_GUARDRAIL_LIMITS);

function staticReadCost(): number {
  const policy = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'entityRetrieval', 'anonymous');
  return policy.costTier === 'static_read' ? 1 : 5;
}

function expensiveReadCost(endpointClass: 'search' | 'geocoding' | 'nearbyDiscovery'): number {
  const policy = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, endpointClass, 'anonymous');
  const base = estimateQueryCost(BASELINE_SEARCH, DEFAULT_QUERY_GUARDRAIL_LIMITS);
  return base + (policy.costTier === 'expensive_read' ? 15 : 0);
}

/** Returns documented cost estimates for each scenario. */
export function estimateScenarioCosts(): readonly CostEstimate[] {
  const geocoderDaily = DEFAULT_DAILY_BUDGETS.geocoder.dailyCap;
  const searchCost = expensiveReadCost('search');
  const geocodeCost = expensiveReadCost('geocoding');
  const staticCost = staticReadCost();

  return [
    {
      scenarioId: 'high_volume_static',
      perRequestCostUnits: staticCost,
      perRequestUsdMicros: microUsd(staticCost),
      notes: 'Cached entity reads; marginal infra cost is lowest tier.',
    },
    {
      scenarioId: 'search_flood',
      perRequestCostUnits: searchCost,
      perRequestUsdMicros: microUsd(searchCost),
      notes: 'Firestore query + index reads; denied requests cost ~0 after guardrails.',
    },
    {
      scenarioId: 'cache_busting',
      perRequestCostUnits: searchCost,
      perRequestUsdMicros: microUsd(searchCost),
      notes: 'Normalized cache keys collapse bust attempts; backend cost only on cache miss.',
    },
    {
      scenarioId: 'geocoder_abuse',
      perRequestCostUnits: geocodeCost + 20,
      perRequestUsdMicros: microUsd(geocodeCost + 20),
      notes: `External geocoder billed; daily hard stop at ${geocoderDaily} requests.`,
    },
    {
      scenarioId: 'submission_spam',
      perRequestCostUnits: 8,
      perRequestUsdMicros: microUsd(8),
      notes: 'Quarantine write + moderation queue; no canonical promotion.',
    },
    {
      scenarioId: 'slow_clients',
      perRequestCostUnits: 12,
      perRequestUsdMicros: microUsd(12),
      notes: 'Concurrency slots held until timeout; App Hosting instance time dominates.',
    },
    {
      scenarioId: 'oversized_payloads',
      perRequestCostUnits: 2,
      perRequestUsdMicros: microUsd(2),
      notes: 'Rejected at validation edge before storage or indexing.',
    },
    {
      scenarioId: 'distributed_low_rate',
      perRequestCostUnits: searchCost,
      perRequestUsdMicros: microUsd(searchCost),
      notes: 'Per-IP quotas evaded but risk aggregation adds cross-dimension score.',
    },
    {
      scenarioId: 'database_connection_exhaustion',
      perRequestCostUnits: 25,
      perRequestUsdMicros: microUsd(25),
      notes: 'Simulated pool slot; denied acquire avoids query planner work.',
    },
    {
      scenarioId: 'queue_retry_storms',
      perRequestCostUnits: 6,
      perRequestUsdMicros: microUsd(6),
      notes: 'Retry budget caps exponential backoff; storm contained at queue layer.',
    },
    {
      scenarioId: 'expensive_filter_combinations',
      perRequestCostUnits: expensiveComboCost,
      perRequestUsdMicros: microUsd(expensiveComboCost),
      notes: 'Max filters + geo + distance sort hits estimated-cost ceiling.',
    },
    {
      scenarioId: 'scraping_patterns',
      perRequestCostUnits: staticCost + searchCost,
      perRequestUsdMicros: microUsd(staticCost + searchCost),
      notes: 'Pagination depth cap + entity read quotas limit harvest rate.',
    },
  ] satisfies readonly CostEstimate[];
}

export function getCostEstimateForScenario(scenarioId: LoadAbuseScenarioId): CostEstimate {
  const row = estimateScenarioCosts().find((entry) => entry.scenarioId === scenarioId);
  if (!row) {
    throw new Error(`missing cost estimate for ${scenarioId}`);
  }
  return row;
}
