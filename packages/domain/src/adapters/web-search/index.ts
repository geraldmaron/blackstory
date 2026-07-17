/**
 * Web-search discovery adapter public surface. Primary provider: Brave Search API —
 * see `./provider-decision.ts` for the full reasoning. Storage-rights gated — see
 * `./normalizer.ts`'s `assertStorageTermsConfirmed` and `./types.ts`'s
 * `WebSearchProviderConfig` doc comment for the fail-closed persistence boundary.
 */
export {
  WEB_SEARCH_PROVIDERS,
  BRAVE_SEARCH_ADAPTER_ID,
  EXA_SEARCH_ADAPTER_ID,
  WEB_SEARCH_PARSER_VERSION,
  WEB_SEARCH_STABLE_ID_SCHEME,
  WEB_SEARCH_PAYLOAD_SCHEMA_VERSION,
  WEB_SEARCH_DEFAULT_CLASSIFICATION,
  webSearchAdapterId,
  type WebSearchProvider,
  type WebSearchProviderConfig,
  type WebSearchRawResult,
  type WebSearchRejectedResult,
  type WebSearchParsedBatch,
  type ExternalQueryProvenance,
  type WebSearchCandidatePayload,
  type WebSearchCandidateRecord,
} from './types.js';

export { WEB_SEARCH_PROVIDER_DECISION } from './provider-decision.js';

export {
  BRAVE_WEB_SEARCH_ENDPOINT,
  BRAVE_API_KEY_HEADER,
  buildBraveWebSearchUrl,
  parseBraveSearchResponse,
  type BuildBraveSearchUrlInput,
} from './brave-client.js';

export {
  buildWebSearchQueryTexts,
  assertQueryTextHasNoResearchOnlyOffensiveTerms,
  type WebSearchGeographicSeed,
  type BuildWebSearchQueryTextsInput,
} from './query-builder.js';

export {
  evaluateWebSearchQueryBudget,
  type DailyBudgetDecision,
  type DailyBudgetEvaluator,
  type BudgetGuardPolicyRow,
  type WebSearchCampaignBudgetPolicy,
  type WebSearchBudgetState,
  type WebSearchBudgetDecision,
} from './budget-guard.js';

export { stampExternalQueryProvenance } from './provenance.js';

export {
  assertStorageTermsConfirmed,
  normalizeWebSearchResult,
  normalizeWebSearchBatch,
  assertWebSearchCandidate,
  type NormalizeWebSearchResultInput,
} from './normalizer.js';

export { createBraveSearchAdapterContract } from './contract.js';

export {
  fetchBraveWebSearch,
  fetchBraveWebSearchBudgeted,
  type FetchBraveWebSearchInput,
  type FetchBraveWebSearchBudgetedInput,
  type FetchBraveWebSearchBudgetedResult,
} from './fetch-search.js';

export {
  ingestWebSearchCandidatesThroughPipeline,
  type IngestWebSearchCandidatesThroughPipelineInput,
} from './pipeline.js';
