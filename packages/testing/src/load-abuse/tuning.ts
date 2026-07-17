
/**
 * Concrete tuning recommendations derived from load/abuse simulations.
 * Values reference current policy defaults in @black-book/security adjust after staging soak.
 */
import {
  DEFAULT_DAILY_BUDGETS,
  DEFAULT_ENDPOINT_QUOTA_MATRIX,
  DEFAULT_QUERY_GUARDRAIL_LIMITS,
  resolveEndpointPolicy,
} from '@black-book/security';
import type { TuningRecommendation } from './types.js';

const searchAnon = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'search', 'anonymous');
const geocodeAnon = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'geocoding', 'anonymous');
const entityAnon = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'entityRetrieval', 'anonymous');

/** Actionable tuning rows for operators not auto-applied. */
export function loadAbuseTuningRecommendations(): readonly TuningRecommendation[] {
  return [
    {
      id: 'tune-search-anon-window',
      scenarioId: 'search_flood',
      controlLayer: 'rate_limit_rolling_window',
      currentValue: `${searchAnon.windowCap}/min`,
      recommendedValue: '6/min if Firestore p95 > 800ms during beta soak',
      rationale:
        'Search floods hit rolling window before daily cap; tighten only if expensive reads dominate p95 latency while static reads stay healthy.',
      priority: 'P1',
    },
    {
      id: 'tune-app-check-search',
      scenarioId: 'search_flood',
      controlLayer: 'app_check',
      currentValue: 'required for anonymous expensive_read',
      recommendedValue: 'keep enforced; monitor missing_app_check risk weight +2',
      rationale:
        'App Check denies ~33% of flood steps without backend work; first line of defense before token bucket.',
      priority: 'P0',
    },
    {
      id: 'tune-geocoder-daily',
      scenarioId: 'geocoder_abuse',
      controlLayer: 'resource_daily_budget',
      currentValue: `${DEFAULT_DAILY_BUDGETS.geocoder.dailyCap} req/day`,
      recommendedValue: '4000 req/day if Maps billing alert fires before 80% soft threshold',
      rationale:
        'Hard stop at 100% prevents runaway external geocoder cost; align alert at 50% with infra/gcp cost runbook.',
      priority: 'P0',
    },
    {
      id: 'tune-geocode-concurrency',
      scenarioId: 'geocoder_abuse',
      controlLayer: 'rate_limit_concurrency',
      currentValue: `${geocodeAnon.maxConcurrency} concurrent`,
      recommendedValue: '1 concurrent (unchanged) — verify slow-client holds release on timeout',
      rationale:
        'Geocoder abuse pairs with slow clients; ensure handlers always releaseConcurrency in finally blocks.',
      priority: 'P1',
    },
    {
      id: 'tune-static-daily',
      scenarioId: 'high_volume_static',
      controlLayer: 'rate_limit_daily_cap',
      currentValue: `${entityAnon.dailyCap}/day entity reads`,
      recommendedValue: 'keep; CDN cache hit ratio target >85% for entity HTML',
      rationale:
        'Static traffic should terminate at edge/CDN; origin daily cap is backstop only.',
      priority: 'P2',
    },
    {
      id: 'tune-distributed-risk',
      scenarioId: 'distributed_low_rate',
      controlLayer: 'rate_limit_risk_score',
      currentValue: 'threshold 12 (5min window)',
      recommendedValue: 'threshold 10 if >6 distinct IPs share device/session signals',
      rationale:
        'Low-rate per-IP attacks evade token bucket; risk aggregation is the independent second family.',
      priority: 'P0',
    },
    {
      id: 'tune-submission-frequency',
      scenarioId: 'submission_spam',
      controlLayer: 'submission_validation',
      currentValue: '8 submissions / hour',
      recommendedValue: '6/hour if coordinated campaign detector flags >3/day',
      rationale:
        'Spam scoring flags content; frequency cap blocks burst without waiting for moderation.',
      priority: 'P1',
    },
    {
      id: 'tune-query-cost-ceiling',
      scenarioId: 'expensive_filter_combinations',
      controlLayer: 'query_guardrails',
      currentValue: `maxEstimatedCost ${DEFAULT_QUERY_GUARDRAIL_LIMITS.maxEstimatedCost}`,
      recommendedValue: '2200 if text_geo_filters p99 exceeds Firestore budget',
      rationale:
        'Guardrails reject max filter + geo + pageSize combos before rate limiter consumes tokens.',
      priority: 'P1',
    },
    {
      id: 'tune-pagination-depth',
      scenarioId: 'scraping_patterns',
      controlLayer: 'query_guardrails',
      currentValue: `depth ${DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPaginationDepth}`,
      recommendedValue: '15 pages if sequential harvest detected via risk endpoint_hopping',
      rationale:
        'Deep cursor pagination is primary scraping vector; pair with entityRetrieval daily cap.',
      priority: 'P1',
    },
    {
      id: 'tune-queue-retries',
      scenarioId: 'queue_retry_storms',
      controlLayer: 'resource_queue_dispatch',
      currentValue: 'submissions-intake maxAttempts 5',
      recommendedValue: 'maxAttempts 4 if retry storm metrics >100/hour in staging',
      rationale:
        'Retry budget exhaustion stops amplification before queue depth fills.',
      priority: 'P2',
    },
    {
      id: 'tune-db-pool-public',
      scenarioId: 'database_connection_exhaustion',
      controlLayer: 'resource_database_pool',
      currentValue: 'role_public_read maxConnections 10',
      recommendedValue: '8 if statement_timeout denials >0.1% (Firestore-era pool is deferred)',
      rationale:
        'Simulated exhaustion fails closed; when SQL paths activate, pool sizing must match guardrail timeouts.',
      priority: 'P2',
    },
    {
      id: 'tune-oversized-json',
      scenarioId: 'oversized_payloads',
      controlLayer: 'submission_validation',
      currentValue: 'maxBytes 16384',
      recommendedValue: 'keep; ensure Content-Length check at edge matches BB-028 limits',
      rationale:
        'Oversized payloads denied before quarantine write — zero storage cost per abusive request.',
      priority: 'P0',
    },
  ] satisfies readonly TuningRecommendation[];
}

export function tuningRecommendationsByPriority(priority: TuningRecommendation['priority']): readonly TuningRecommendation[] {
  return loadAbuseTuningRecommendations().filter((row) => row.priority === priority);
}
