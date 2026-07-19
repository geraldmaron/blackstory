/**
 * Fetches web-search results (Brave or SearXNG) through the safe HTTP port. Never calls
 * `fetch` directly — see ../internet-archive/shared/http-port.ts. Caller supplies keys /
 * base URLs; this module never reads env vars. Budgeted helpers check the campaign budget
 * guard before any network call. Storage-terms gating happens at normalize/persist time.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
} from '../internet-archive/shared/http-port.js';
import type { SourceRegistryEntry } from '../types.js';
import { BRAVE_API_KEY_HEADER, buildBraveWebSearchUrl, parseBraveSearchResponse } from './brave-client.js';
import {
  buildSearxngSearchUrl,
  parseSearxngSearchResponse,
} from './searxng-client.js';
import {
  evaluateWebSearchQueryBudget,
  type DailyBudgetEvaluator,
  type WebSearchBudgetDecision,
  type WebSearchBudgetState,
  type WebSearchCampaignBudgetPolicy,
} from './budget-guard.js';
import { normalizeWebSearchBatch } from './normalizer.js';
import { stampExternalQueryProvenance } from './provenance.js';
import type { WebSearchCandidateRecord, WebSearchProviderConfig } from './types.js';

const WEB_SEARCH_ALLOWED_CONTENT_TYPES = ['application/json', 'text/json'];

export type FetchBraveWebSearchInput = {
  readonly query: string;
  readonly config: WebSearchProviderConfig;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
  readonly count?: number;
  readonly offset?: number;
};

export async function fetchBraveWebSearch(input: FetchBraveWebSearchInput): Promise<readonly WebSearchCandidateRecord[]> {
  if (input.config.provider !== 'brave') {
    throw new Error(`fetchBraveWebSearch requires provider=brave; got ${input.config.provider}`);
  }
  if (!input.config.apiKey.trim()) {
    throw new Error('BRAVE_SEARCH_API_KEY is required -- see .env.example (never hardcode a key)');
  }
  const url = buildBraveWebSearchUrl({
    query: input.query,
    ...(input.count !== undefined ? { count: input.count } : {}),
    ...(input.offset !== undefined ? { offset: input.offset } : {}),
  });
  const response = await withRetry(
    () =>
      input.client({
        url,
        method: 'GET',
        headers: { [BRAVE_API_KEY_HEADER]: input.config.apiKey, accept: 'application/json' },
        allowedContentTypes: WEB_SEARCH_ALLOWED_CONTENT_TYPES,
      }),
    { retries: input.retries ?? 3, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, WEB_SEARCH_ALLOWED_CONTENT_TYPES);
  const raw = JSON.parse(response.bodyText) as unknown;
  const batch = parseBraveSearchResponse(raw);

  const queryProvenance = stampExternalQueryProvenance({
    provider: input.config.provider,
    queryText: input.query,
    executedAt: input.capturedAt,
    planTermsVersion: input.config.planTermsVersion,
  });

  return normalizeWebSearchBatch({
    results: batch.results,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
    config: input.config,
    queryProvenance,
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
  });
}

export type FetchSearxngWebSearchInput = {
  readonly query: string;
  readonly config: WebSearchProviderConfig;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
  readonly categories?: string;
  readonly language?: string;
};

export async function fetchSearxngWebSearch(
  input: FetchSearxngWebSearchInput,
): Promise<readonly WebSearchCandidateRecord[]> {
  if (input.config.provider !== 'searxng') {
    throw new Error(`fetchSearxngWebSearch requires provider=searxng; got ${input.config.provider}`);
  }
  const baseUrl = input.config.baseUrl?.trim();
  if (!baseUrl) {
    throw new Error('SEARXNG_BASE_URL is required on WebSearchProviderConfig.baseUrl for live SearXNG fetch');
  }
  const url = buildSearxngSearchUrl({
    baseUrl,
    query: input.query,
    ...(input.categories !== undefined ? { categories: input.categories } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
  });
  const headers: Record<string, string> = { accept: 'application/json' };
  if (input.config.apiKey.trim()) {
    headers.authorization = `Bearer ${input.config.apiKey}`;
  }
  const response = await withRetry(
    () =>
      input.client({
        url,
        method: 'GET',
        headers,
        allowedContentTypes: WEB_SEARCH_ALLOWED_CONTENT_TYPES,
      }),
    { retries: input.retries ?? 3, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, WEB_SEARCH_ALLOWED_CONTENT_TYPES);
  const raw = JSON.parse(response.bodyText) as unknown;
  const batch = parseSearxngSearchResponse(raw);

  const queryProvenance = stampExternalQueryProvenance({
    provider: input.config.provider,
    queryText: input.query,
    executedAt: input.capturedAt,
    planTermsVersion: input.config.planTermsVersion,
  });

  return normalizeWebSearchBatch({
    results: batch.results,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
    config: input.config,
    queryProvenance,
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
  });
}

export type FetchBraveWebSearchBudgetedInput = FetchBraveWebSearchInput & {
  readonly budgetPolicy: WebSearchCampaignBudgetPolicy;
  readonly budgetState: WebSearchBudgetState;
  readonly evaluateDailyBudget: DailyBudgetEvaluator;
};

export type FetchBraveWebSearchBudgetedResult = {
  readonly candidates: readonly WebSearchCandidateRecord[];
  readonly budgetDecision: WebSearchBudgetDecision;
};

/** Checks the -backed budget guard BEFORE issuing the query; throws (fails closed) when denied. */
export async function fetchBraveWebSearchBudgeted(
  input: FetchBraveWebSearchBudgetedInput,
): Promise<FetchBraveWebSearchBudgetedResult> {
  const budgetDecision = evaluateWebSearchQueryBudget({
    policy: input.budgetPolicy,
    state: input.budgetState,
    evaluateDailyBudget: input.evaluateDailyBudget,
  });
  if (!budgetDecision.allowed) {
    throw new Error(`Web search query budget denied: ${budgetDecision.reason ?? 'budget exceeded'}`);
  }
  const candidates = await fetchBraveWebSearch(input);
  return { candidates, budgetDecision };
}
