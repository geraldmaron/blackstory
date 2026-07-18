
/**
 * abuse scenario runners deterministic fixtures against security guardrails.
 */
import {
  DEFAULT_DAILY_BUDGETS,
  DEFAULT_CLOUD_TASKS_POLICIES,
  DEFAULT_ENDPOINT_QUOTA_MATRIX,
  DEFAULT_QUERY_GUARDRAIL_LIMITS,
  encodeSearchCursor,
  evaluateSearchQueryGuardrails,
  hashCanonicalQuery,
  resolveEndpointPolicy,
  type SubmissionInput,
} from '@blap/security';
import {
  buildCacheKeyFromQuery,
  cacheKeyCollapsesVariants,
  createLoadAbuseHarness,
  proveLayeredControls,
  summarizeScenario,
  type LoadAbuseHarnessOptions,
} from './harness.js';
import { getCostEstimateForScenario } from './cost-model.js';
import type { LayeredControlProof, LoadAbuseScenarioId, ScenarioRunResult, SimulatedRequestOutcome } from './types.js';

const BASE_NOW_MS = 1_700_000_000_000;
const STATIC_IP = '203.0.113.1';

const VALID_SUBMISSION: SubmissionInput = {
  kind: 'correction',
  title: 'Correct the opening year',
  statement: 'The institution opened in 1954 according to the attached public archives.',
  sourceUrls: ['https://archive.example.org/item/123'],
  targetRecordId: 'record-123',
};

export type ScenarioRunner = (
  harness?: ReturnType<typeof createLoadAbuseHarness>,
) => {
  readonly result: ScenarioRunResult;
  readonly proof: LayeredControlProof;
};

function runner(
  scenarioId: LoadAbuseScenarioId,
  execute: (h: ReturnType<typeof createLoadAbuseHarness>) => {
    outcomes: readonly SimulatedRequestOutcome[];
    options?: Parameters<typeof summarizeScenario>[2];
  },
  options: LoadAbuseHarnessOptions = {},
): ScenarioRunner {
  return (harness = createLoadAbuseHarness({ nowMs: BASE_NOW_MS, ...options })) => {
    const { outcomes, options: summaryOptions } = execute(harness);
    const result = summarizeScenario(scenarioId, outcomes, summaryOptions);
    const proof = proveLayeredControls(scenarioId, result.layersTriggered);
    return { result, proof };
  };
}

export const runHighVolumeStaticScenario = runner('high_volume_static', (h) => {
  const policy = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'entityRetrieval', 'anonymous');
  const outcomes: SimulatedRequestOutcome[] = [];
  for (let i = 0; i < policy.windowCap + 5; i += 1) {
    h.advance(100);
    const rate = h.simulateRateLimit({
      subject: 'anonymous',
      endpointClass: 'entityRetrieval',
      clientIp: STATIC_IP,
      appCheckVerified: true,
    });
    outcomes.push(
      rate.decision.allowed
        ? { allowed: true, denials: [], estimatedCostUnits: 1 }
        : {
            allowed: false,
            denials: [{ layer: 'rate_limit_rolling_window', reason: 'rolling_window_exceeded' }],
            estimatedCostUnits: 0,
          },
    );
  }
  const searchDenied = h.simulateRateLimit({
    subject: 'anonymous',
    endpointClass: 'search',
    clientIp: STATIC_IP,
    appCheckVerified: false,
  });
  outcomes.push(
    searchDenied.decision.allowed
      ? { allowed: true, denials: [], estimatedCostUnits: 0 }
      : {
          allowed: false,
          denials: [{ layer: 'app_check', reason: 'app_check_required' }],
          estimatedCostUnits: 0,
        },
  );
  return { outcomes, options: { publicStaticPreserved: true, withinResourceCaps: true } };
});

export const runSearchFloodScenario = runner('search_flood', (h) => {
  const outcomes: SimulatedRequestOutcome[] = [];
  for (let i = 0; i < 40; i += 1) {
    outcomes.push(
      h.simulateSearch({
        query: { q: `historical record ${i}` },
        rateLimit: {
          subject: 'anonymous',
          endpointClass: 'search',
          clientIp: '203.0.113.2',
          appCheckVerified: i % 3 !== 0,
        },
      }),
    );
  }
  return { outcomes, options: { withinResourceCaps: true } };
});

export const runCacheBustingScenario = runner('cache_busting', (h) => {
  const base = 'Harlem Renaissance';
  const variants = [
    '  harlem   renaissance  ',
    'HARLEM renaissance',
    'harlem\u200b renaissance',
    'harlem renaissance',
  ];
  const collapsed = cacheKeyCollapsesVariants(base, variants);
  const keys = variants.map((q) =>
    buildCacheKeyFromQuery({ q, filters: { kind: 'person' }, sort: 'relevance' }),
  );
  const outcomes: SimulatedRequestOutcome[] = [
    {
      allowed: collapsed && keys.every((key) => key === keys[0]),
      denials: collapsed ? [] : [{ layer: 'query_guardrails', reason: 'normalization_failed' }],
      estimatedCostUnits: 0,
    },
  ];
  outcomes.push(
    h.simulateSearch({
      query: { q: '/harlem.*/i' },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.3',
        appCheckVerified: true,
      },
    }),
  );
  for (let i = 0; i < 12; i += 1) {
    outcomes.push(
      h.simulateSearch({
        query: { q: `cache bust variant ${i}`, filters: { kind: 'person' } },
        rateLimit: {
          subject: 'anonymous',
          endpointClass: 'search',
          clientIp: '203.0.113.3',
          appCheckVerified: true,
        },
      }),
    );
  }
  return { outcomes };
});

export const runGeocoderAbuseScenario = runner('geocoder_abuse', (h) => {
  const cap = DEFAULT_DAILY_BUDGETS.geocoder.dailyCap;
  const policy = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'geocoding', 'anonymous');
  const outcomes: SimulatedRequestOutcome[] = [
    h.simulateGeocoderBudget(cap - 1),
    h.simulateGeocoderBudget(cap),
    h.simulateGeocoderBudget(cap + 100),
  ];
  for (let i = 0; i < policy.windowCap + 3; i += 1) {
    h.advance(100);
    const rate = h.simulateRateLimit({
      subject: 'anonymous',
      endpointClass: 'geocoding',
      clientIp: '203.0.113.50',
      appCheckVerified: true,
    });
    outcomes.push(
      rate.decision.allowed
        ? { allowed: true, denials: [], estimatedCostUnits: getCostEstimateForScenario('geocoder_abuse').perRequestCostUnits }
        : {
            allowed: false,
            denials: [{ layer: mapRateLayer(rate.decision.reason), reason: rate.decision.reason }],
            estimatedCostUnits: 0,
          },
    );
  }
  return { outcomes, options: { withinResourceCaps: true } };
});

function mapRateLayer(reason: string): SimulatedRequestOutcome['denials'][number]['layer'] {
  if (reason === 'token_bucket_exhausted') return 'rate_limit_token_bucket';
  if (reason === 'daily_cap_exceeded') return 'rate_limit_daily_cap';
  if (reason === 'concurrency_exceeded') return 'rate_limit_concurrency';
  if (reason === 'risk_score_exceeded') return 'rate_limit_risk_score';
  if (reason === 'app_check_required') return 'app_check';
  return 'rate_limit_rolling_window';
}

export const runSubmissionSpamScenario = runner('submission_spam', (h) => ({
  outcomes: [
    h.simulateSubmission({
      payload: {
        kind: 'contribution',
        title: 'BUY NOW GUARANTEED PROFIT',
        statement: 'CLICK HERE '.repeat(40),
        sourceUrls: Array.from({ length: 6 }, (_, i) => `https://spam.example/${i}`),
      },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'corrections',
        clientIp: '203.0.113.77',
        appCheckVerified: true,
      },
    }),
    h.simulateSubmission({
      payload: VALID_SUBMISSION,
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'corrections',
        clientIp: '203.0.113.77',
        appCheckVerified: true,
      },
      recentSubmissionTimestamps: [h.nowMs - 1_000, h.nowMs - 2_000, h.nowMs - 3_000],
    }),
  ],
}));

export const runSlowClientsScenario = runner('slow_clients', (h) => ({
  outcomes: [
    h.simulateSlowClientHold({
      subject: 'anonymous',
      endpointClass: 'search',
      clientIp: '203.0.113.88',
      appCheckVerified: true,
    }),
    h.simulateSearch({
      query: { q: 'slow follow-up' },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.88',
        appCheckVerified: false,
      },
    }),
  ],
  options: { withinResourceCaps: true },
}));

export const runOversizedPayloadsScenario = runner('oversized_payloads', (h) => ({
  outcomes: [
    h.simulateSearch({
      query: { q: 'x'.repeat(DEFAULT_QUERY_GUARDRAIL_LIMITS.maxQueryLength + 50) },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.90',
        appCheckVerified: true,
      },
    }),
    h.simulateSubmission({
      payload: {
        ...VALID_SUBMISSION,
        statement: `Valid intro. ${'https://example.org/x '.repeat(200)}`,
      },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'corrections',
        clientIp: '203.0.113.91',
        appCheckVerified: true,
      },
    }),
  ],
}));

export const runDistributedLowRateScenario = runner('distributed_low_rate', (h) => {
  const nowMs = h.nowMs;
  const signals = Array.from({ length: 8 }, (_, i) => ({
    kind: 'ip_burst' as const,
    weight: 2,
    observedAtMs: nowMs - i * 1_000,
    dimension: `203.0.113.${100 + i}`,
  }));
  const outcomes: SimulatedRequestOutcome[] = [];
  for (let i = 0; i < 8; i += 1) {
    outcomes.push(
      h.simulateSearch({
        query: { q: 'archive scan' },
        rateLimit: {
          subject: 'anonymous',
          endpointClass: 'search',
          clientIp: `203.0.113.${100 + i}`,
          appCheckVerified: i % 2 === 0,
          riskSignals: signals,
        },
      }),
    );
  }
  return { outcomes };
});

export const runDatabaseConnectionExhaustionScenario = runner('database_connection_exhaustion', (h) => {
  const harness = createLoadAbuseHarness({ nowMs: BASE_NOW_MS });
  const max = 10;
  const outcomes: SimulatedRequestOutcome[] = [
    harness.simulateDatabaseAcquire('role_public_read', max - 1),
    harness.simulateDatabaseAcquire('role_public_read', max),
    harness.simulateDatabaseAcquire('role_public_read', max + 5),
  ];
  outcomes.push(
    h.simulateSearch({
      query: { q: 'pool pressure probe' },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.95',
        appCheckVerified: true,
      },
    }),
  );
  return { outcomes, options: { withinResourceCaps: true } };
});

export const runQueueRetryStormsScenario = runner('queue_retry_storms', (h) => {
  const harness = createLoadAbuseHarness({ nowMs: BASE_NOW_MS });
  const policy = DEFAULT_CLOUD_TASKS_POLICIES['submissions-intake'];
  const outcomes: SimulatedRequestOutcome[] = [
    harness.simulateQueueRetryStorm('submissions-intake', 1),
    harness.simulateQueueRetryStorm('submissions-intake', policy.maxAttempts),
    harness.simulateQueueRetryStorm('submissions-intake', policy.maxAttempts + 2),
  ];
  outcomes.push(
    h.simulateSubmission({
      payload: VALID_SUBMISSION,
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'corrections',
        clientIp: '203.0.113.96',
        appCheckVerified: true,
      },
    }),
  );
  return { outcomes, options: { withinResourceCaps: true } };
});

export const runExpensiveFilterCombinationsScenario = runner('expensive_filter_combinations', (h) => {
  const outcomes: SimulatedRequestOutcome[] = [
    h.simulateSearch({
      query: {
        q: 'historical movement',
        filters: {
          kind: 'person',
          state: 'published',
          precision: 'city',
          status: 'verified',
          era: 'civil-rights',
        },
        lat: 38.9072,
        lng: -77.0369,
        radiusM: 50_000,
        sort: 'distance',
        pageSize: 50,
      },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.120',
        appCheckVerified: true,
      },
    }),
    h.simulateSearch({
      query: {
        q: 'probe',
        filters: {
          kind: 'person',
          state: 'published',
          precision: 'city',
          status: 'verified',
          era: 'civil-rights',
          releaseId: 'extra-filter',
        },
      },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.120',
        appCheckVerified: true,
      },
    }),
    h.simulateSearch({
      query: { q: 'a'.repeat(DEFAULT_QUERY_GUARDRAIL_LIMITS.maxQueryLength + 1) },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.121',
        appCheckVerified: true,
      },
    }),
  ];
  for (let i = 0; i < 12; i += 1) {
    outcomes.push(
      h.simulateSearch({
        query: {
          q: 'expensive combo',
          filters: { kind: 'person', state: 'published' },
          lat: 38.9,
          lng: -77.0,
          radiusM: 50_000,
          sort: 'distance',
        },
        rateLimit: {
          subject: 'anonymous',
          endpointClass: 'search',
          clientIp: '203.0.113.120',
          appCheckVerified: true,
        },
      }),
    );
  }
  return { outcomes };
});

export const runScrapingPatternsScenario = runner('scraping_patterns', (h) => {
  const baseQuery = { q: 'public archive', filters: { kind: 'person' } };
  const first = evaluateSearchQueryGuardrails(baseQuery);
  const outcomes: SimulatedRequestOutcome[] = [];
  if (!first.allowed) {
    outcomes.push({
      allowed: false,
      denials: [{ layer: 'query_guardrails', reason: first.reason }],
      estimatedCostUnits: 0,
    });
    return { outcomes, options: { publicStaticPreserved: true } };
  }
  const queryHash = hashCanonicalQuery(first.canonical);
  const deepCursor = encodeSearchCursor({
    v: 1,
    depth: DEFAULT_QUERY_GUARDRAIL_LIMITS.maxPaginationDepth,
    queryHash,
    position: 'doc-999',
  });
  outcomes.push(
    h.simulateSearch({
      query: { ...baseQuery, cursor: deepCursor },
      rateLimit: {
        subject: 'anonymous',
        endpointClass: 'search',
        clientIp: '203.0.113.130',
        appCheckVerified: true,
      },
    }),
  );
  const entityPolicy = resolveEndpointPolicy(DEFAULT_ENDPOINT_QUOTA_MATRIX, 'entityRetrieval', 'anonymous');
  for (let i = 0; i < entityPolicy.dailyCap + 2; i += 1) {
    h.advance(50);
    const rate = h.simulateRateLimit({
      subject: 'anonymous',
      endpointClass: 'entityRetrieval',
      clientIp: '203.0.113.131',
      appCheckVerified: true,
    });
    outcomes.push(
      rate.decision.allowed
        ? { allowed: true, denials: [], estimatedCostUnits: 1 }
        : {
            allowed: false,
            denials: [{ layer: 'rate_limit_daily_cap', reason: 'daily_cap_exceeded' }],
            estimatedCostUnits: 0,
          },
    );
  }
  return { outcomes, options: { publicStaticPreserved: true } };
});

export function runAllLoadAbuseScenarios(): readonly {
  readonly scenarioId: LoadAbuseScenarioId;
  readonly result: ScenarioRunResult;
  readonly proof: LayeredControlProof;
}[] {
  const runners: ScenarioRunner[] = [
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
  ];
  return runners.map((run) => {
    const { result, proof } = run();
    return { scenarioId: result.scenarioId, result, proof };
  });
}
