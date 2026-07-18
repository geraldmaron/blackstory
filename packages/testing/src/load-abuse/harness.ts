
/**
 * Layered load/abuse simulation harness.
 * Composes rate limits, query guardrails, submission controls,
 * and resource caps without network I/O.
 */
import {
  aggregateDistributedRisk,
  buildRateLimitKey,
  buildSearchCacheKey,
  canonicalizeForCacheKey,
  createInMemoryRateLimitStore,
  createRateLimitEvaluator,
  DEFAULT_CLOUD_TASKS_POLICIES,
  DEFAULT_DAILY_BUDGETS,
  DEFAULT_ENDPOINT_QUOTA_MATRIX,
  evaluateDailyBudget,
  evaluateDatabaseAcquire,
  evaluateQueueDispatch,
  evaluateQuota,
  evaluateScalingCap,
  evaluateSearchQueryGuardrails,
  evaluateSoftShutdown,
  isRetryBudgetExhausted,
  releaseConcurrency,
  resolveEndpointPolicy,
  scoreSubmissionSpam,
  validateAndNormalizeSubmission,
  type EndpointClass,
  type QuotaDecision,
  type RateLimitStore,
  type RiskSignal,
  type SearchQueryInput,
  type SubmissionInput,
} from '@blap/security';
import { getCostEstimateForScenario } from './cost-model.js';
import type {
  ControlDenial,
  ControlLayer,
  LayeredControlProof,
  LoadAbuseScenarioId,
  ScenarioRunResult,
  SimulatedRequestOutcome,
} from './types.js';

export type LoadAbuseHarnessOptions = {
  readonly nowMs?: number;
  readonly store?: RateLimitStore;
};

export type RateLimitSimInput = {
  readonly subject: 'anonymous' | 'authenticated';
  readonly endpointClass: EndpointClass;
  readonly clientIp: string;
  readonly appCheckVerified?: boolean;
  readonly riskSignals?: readonly RiskSignal[];
  readonly releaseAfter?: boolean;
};

export type SearchSimInput = {
  readonly query: SearchQueryInput;
  readonly rateLimit: RateLimitSimInput;
};

export type SubmissionSimInput = {
  readonly payload: SubmissionInput;
  readonly rateLimit: RateLimitSimInput;
  readonly recentSubmissionTimestamps?: readonly number[];
};

function mapQuotaDenial(reason: string): ControlDenial {
  switch (reason) {
    case 'token_bucket_exhausted':
      return { layer: 'rate_limit_token_bucket', reason };
    case 'rolling_window_exceeded':
      return { layer: 'rate_limit_rolling_window', reason };
    case 'daily_cap_exceeded':
      return { layer: 'rate_limit_daily_cap', reason };
    case 'concurrency_exceeded':
      return { layer: 'rate_limit_concurrency', reason };
    case 'risk_score_exceeded':
      return { layer: 'rate_limit_risk_score', reason };
    case 'app_check_required':
      return { layer: 'app_check', reason };
    default:
      return { layer: 'rate_limit_rolling_window', reason };
  }
}

export function createLoadAbuseHarness(options: LoadAbuseHarnessOptions = {}) {
  const store = options.store ?? createInMemoryRateLimitStore({ maxKeys: 20_000 });
  let nowMs = options.nowMs ?? 1_700_000_000_000;
  const evaluator = createRateLimitEvaluator({ store, now: () => nowMs });

  return {
    get store(): RateLimitStore {
      return store;
    },
    get nowMs(): number {
      return nowMs;
    },
    advance(ms: number): void {
      nowMs += ms;
    },
    setNow(ms: number): void {
      nowMs = ms;
    },

    simulateRateLimit(input: RateLimitSimInput): { decision: QuotaDecision; key: string } {
      const key = buildRateLimitKey({
        subject: input.subject,
        endpointClass: input.endpointClass,
        clientIp: input.clientIp,
      });
      const decision = evaluator.evaluate({
        subject: input.subject,
        endpointClass: input.endpointClass,
        key,
        ...(input.appCheckVerified !== undefined ? { appCheckVerified: input.appCheckVerified } : {}),
        ...(input.riskSignals !== undefined ? { riskSignals: input.riskSignals } : {}),
      });
      if (input.releaseAfter !== false && decision.allowed) {
        evaluator.release(key);
      }
      return { decision, key };
    },

    simulateSearch(input: SearchSimInput): SimulatedRequestOutcome {
      const denials: ControlDenial[] = [];
      const guardrail = evaluateSearchQueryGuardrails(input.query);
      if (!guardrail.allowed) {
        denials.push({ layer: 'query_guardrails', reason: guardrail.reason });
        return { allowed: false, denials, estimatedCostUnits: 0 };
      }

      const { decision } = this.simulateRateLimit({
        ...input.rateLimit,
        endpointClass: 'search',
        releaseAfter: true,
      });
      if (!decision.allowed) {
        denials.push(mapQuotaDenial(decision.reason));
      }

      return {
        allowed: denials.length === 0,
        denials,
        estimatedCostUnits: denials.length === 0 ? guardrail.estimatedCost : 0,
      };
    },

    simulateSubmission(input: SubmissionSimInput): SimulatedRequestOutcome {
      const denials: ControlDenial[] = [];
      const validation = validateAndNormalizeSubmission(input.payload, {
        nowMs,
        ...(input.recentSubmissionTimestamps !== undefined
          ? { recentSubmissionTimestamps: input.recentSubmissionTimestamps }
          : {}),
      });
      if (!validation.valid) {
        denials.push({
          layer: 'submission_validation',
          reason: validation.issues.map((issue) => issue.reason).join(','),
        });
        return { allowed: false, denials, estimatedCostUnits: 0 };
      }

      const spam = scoreSubmissionSpam(validation.normalized);
      if (spam.shouldFlag) {
        denials.push({
          layer: 'submission_spam_score',
          reason: spam.signals.join(','),
        });
      }

      const { decision } = this.simulateRateLimit({
        ...input.rateLimit,
        endpointClass: 'corrections',
        releaseAfter: true,
      });
      if (!decision.allowed) {
        denials.push(mapQuotaDenial(decision.reason));
      }

      return {
        allowed: denials.length === 0,
        denials,
        estimatedCostUnits: denials.length === 0 ? 8 : 0,
      };
    },

    simulateDatabaseAcquire(role: string, activeConnections: number): SimulatedRequestOutcome {
      const decision = evaluateDatabaseAcquire({ role, activeConnections });
      if (!decision.allowed) {
        return {
          allowed: false,
          denials: [{ layer: 'resource_database_pool', reason: decision.reason }],
          estimatedCostUnits: 0,
        };
      }
      return { allowed: true, denials: [], estimatedCostUnits: 25 };
    },

    simulateQueueRetryStorm(
      queueId: keyof typeof DEFAULT_CLOUD_TASKS_POLICIES,
      attempt: number,
    ): SimulatedRequestOutcome {
      const policy = DEFAULT_CLOUD_TASKS_POLICIES[queueId];
      const denials: ControlDenial[] = [];
      if (isRetryBudgetExhausted(attempt, policy.retry)) {
        denials.push({ layer: 'resource_queue_dispatch', reason: 'retry_budget_exhausted' });
      }
      const dispatch = evaluateQueueDispatch({
        queueId,
        dispatchesThisSecond: policy.maxDispatchesPerSecond + 1,
        activeDispatches: policy.maxConcurrentDispatches + 1,
        queueDepth: policy.maxQueueDepth,
        attempt,
      });
      if (!dispatch.allowed && denials.length === 0) {
        denials.push({ layer: 'resource_queue_dispatch', reason: dispatch.reason });
      }
      return { allowed: denials.length === 0, denials, estimatedCostUnits: denials.length === 0 ? 6 : 0 };
    },

    simulateGeocoderBudget(consumed: number): SimulatedRequestOutcome {
      const budget = evaluateDailyBudget({ category: 'geocoder', consumed });
      const denials: ControlDenial[] = [];
      if (!budget.allowed) {
        denials.push({ layer: 'resource_daily_budget', reason: 'daily_budget_exceeded' });
      }
      const rate = this.simulateRateLimit({
        subject: 'anonymous',
        endpointClass: 'geocoding',
        clientIp: '203.0.113.50',
        appCheckVerified: true,
      });
      if (!rate.decision.allowed) {
        denials.push(mapQuotaDenial(rate.decision.reason));
      }
      return {
        allowed: denials.length === 0,
        denials,
        estimatedCostUnits:
          denials.length === 0 ? getCostEstimateForScenario('geocoder_abuse').perRequestCostUnits : 0,
      };
    },

    simulateScalingSpike(
      serviceId: 'web' | 'api-public' | 'api-submissions' | 'api-internal' | 'admin',
      requested: number,
    ): SimulatedRequestOutcome {
      const decision = evaluateScalingCap({ serviceId, requestedInstances: requested });
      if (!decision.allowed) {
        return {
          allowed: false,
          denials: [{ layer: 'resource_scaling_cap', reason: decision.reason }],
          estimatedCostUnits: 0,
        };
      }
      return { allowed: true, denials: [], estimatedCostUnits: 1 };
    },

    simulateSlowClientHold(input: RateLimitSimInput): SimulatedRequestOutcome {
      const key = buildRateLimitKey({
        subject: input.subject,
        endpointClass: input.endpointClass,
        clientIp: input.clientIp,
      });
      const policy = resolveEndpointPolicy(
        DEFAULT_ENDPOINT_QUOTA_MATRIX,
        input.endpointClass,
        input.subject,
      );
      const denials: ControlDenial[] = [];
      for (let slot = 0; slot < policy.maxConcurrency; slot += 1) {
        const decision = evaluateQuota(
          {
            subject: input.subject,
            endpointClass: input.endpointClass,
            key,
            nowMs,
            consume: true,
            ...(input.appCheckVerified !== undefined ? { appCheckVerified: input.appCheckVerified } : {}),
          },
          { store },
        );
        if (!decision.allowed) {
          denials.push(mapQuotaDenial(decision.reason));
          break;
        }
      }
      const blocked = evaluateQuota(
        {
          subject: input.subject,
          endpointClass: input.endpointClass,
          key,
          nowMs,
          consume: true,
          ...(input.appCheckVerified !== undefined ? { appCheckVerified: input.appCheckVerified } : {}),
        },
        { store },
      );
      if (!blocked.allowed) {
        denials.push(mapQuotaDenial(blocked.reason));
      }
      releaseConcurrency(store, key, nowMs);
      return {
        allowed: denials.length === 0,
        denials,
        estimatedCostUnits: denials.length === 0 ? 12 : 0,
      };
    },
  };
}

export function cacheKeyCollapsesVariants(baseQuery: string, variants: readonly string[]): boolean {
  const canonical = canonicalizeForCacheKey(baseQuery);
  return variants.every((variant) => canonicalizeForCacheKey(variant) === canonical);
}

export function buildCacheKeyFromQuery(input: SearchQueryInput): string | null {
  const decision = evaluateSearchQueryGuardrails(input);
  if (!decision.allowed) {
    return null;
  }
  return buildSearchCacheKey(decision.canonical);
}

export function aggregateDistributedLowRate(signals: readonly RiskSignal[], nowMs: number): {
  readonly exceedsThreshold: boolean;
  readonly totalScore: number;
} {
  const agg = aggregateDistributedRisk(signals, nowMs);
  return { exceedsThreshold: agg.exceedsThreshold, totalScore: agg.totalScore };
}

export function summarizeScenario(
  scenarioId: LoadAbuseScenarioId,
  outcomes: readonly SimulatedRequestOutcome[],
  options: { readonly publicStaticPreserved?: boolean; readonly withinResourceCaps?: boolean } = {},
): ScenarioRunResult {
  const layers = new Set<ControlLayer>();
  let allowedCount = 0;
  let deniedCount = 0;
  let totalCost = 0;
  let firstDenialLayer: ControlLayer | undefined;

  for (const outcome of outcomes) {
    if (outcome.allowed) {
      allowedCount += 1;
      totalCost += outcome.estimatedCostUnits;
    } else {
      deniedCount += 1;
      for (const denial of outcome.denials) {
        layers.add(denial.layer);
        firstDenialLayer ??= denial.layer;
      }
    }
  }

  return {
    scenarioId,
    stepsExecuted: outcomes.length,
    allowedCount,
    deniedCount,
    layersTriggered: [...layers],
    ...(firstDenialLayer !== undefined ? { firstDenialLayer } : {}),
    totalEstimatedCostUnits: totalCost,
    publicStaticPreserved: options.publicStaticPreserved ?? true,
    withinResourceCaps: options.withinResourceCaps ?? true,
  };
}

export function proveLayeredControls(
  scenarioId: LoadAbuseScenarioId,
  layers: readonly ControlLayer[],
): LayeredControlProof {
  const unique = [...new Set(layers)];
  const rateLayers = unique.filter((layer) => layer.startsWith('rate_limit'));
  const resourceLayers = unique.filter((layer) => layer.startsWith('resource'));
  const otherLayers = unique.filter(
    (layer) => !layer.startsWith('rate_limit') && !layer.startsWith('resource'),
  );
  const families = [rateLayers.length > 0, resourceLayers.length > 0, otherLayers.length > 0].filter(Boolean)
    .length;
  return {
    scenarioId,
    layersObserved: unique,
    independentLayers: unique.length,
    survivesSingleLayerBypass: unique.length >= 2 && families >= 2,
  };
}

export function assertPublicServingUnderBudgetPressure(): boolean {
  const hardStopBudget = evaluateDailyBudget({
    category: 'research_campaign',
    consumed: DEFAULT_DAILY_BUDGETS.research_campaign.dailyCap,
  });
  const publicTier = evaluateSoftShutdown({
    tier: 'public_serving',
    budgetPercentUsed: hardStopBudget.percentUsed,
    hardStopActive: hardStopBudget.hardStopTriggered,
  });
  const researchTier = evaluateSoftShutdown({
    tier: 'optional_research',
    budgetPercentUsed: hardStopBudget.percentUsed,
    hardStopActive: hardStopBudget.hardStopTriggered,
  });
  return publicTier.allowed && !researchTier.allowed;
}
