/**
 * Fetches Brave Web Search results through the BB-030 safe HTTP port (BB-075). Never calls
 * `fetch` directly -- see ../internet-archive/shared/http-port.ts for why. The API key is always
 * supplied by the caller (e.g. `BRAVE_SEARCH_API_KEY`) -- never hardcoded or read from an env var
 * here; tests pass a deterministic fake key, mirroring ../dpla/fetch-search.ts's convention.
 *
 * `fetchBraveWebSearchBudgeted` checks the BB-033-backed budget guard (./budget-guard.ts) BEFORE
 * issuing the query at all -- a denied budget never reaches the network. `fetchBraveWebSearch`
 * performs the HTTP call and normalization; normalization's own storage-terms gate
 * (./normalizer.ts `assertStorageTermsConfirmed`) is a separate, independent check -- a search
 * call itself is not gated by storage-rights confirmation (only persistence is), so
 * `fetchBraveWebSearch` may execute the live query even when `storageTermsConfirmed` is false and
 * will only fail once it tries to turn a result into a storable candidate.
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

export type FetchBraveWebSearchBudgetedInput = FetchBraveWebSearchInput & {
  readonly budgetPolicy: WebSearchCampaignBudgetPolicy;
  readonly budgetState: WebSearchBudgetState;
  readonly evaluateDailyBudget: DailyBudgetEvaluator;
};

export type FetchBraveWebSearchBudgetedResult = {
  readonly candidates: readonly WebSearchCandidateRecord[];
  readonly budgetDecision: WebSearchBudgetDecision;
};

/** Checks the BB-033-backed budget guard BEFORE issuing the query; throws (fails closed) when denied. */
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
