/**
 * Internet Archive community discovery adapter public surface.
 */
export {
  INTERNET_ARCHIVE_ADAPTER_ID,
  INTERNET_ARCHIVE_PARSER_VERSION,
  INTERNET_ARCHIVE_STABLE_ID_SCHEME,
  INTERNET_ARCHIVE_PAYLOAD_SCHEMA_VERSION,
  INTERNET_ARCHIVE_DEFAULT_CLASSIFICATION,
  type InternetArchiveSearchDoc,
  type InternetArchiveAdvancedSearchResponse,
  type InternetArchiveScrapeResponse,
  type InternetArchiveMetadataResponse,
  type InternetArchiveRejectedDoc,
  type InternetArchiveParsedBatch,
  type InternetArchiveCandidatePayload,
  type InternetArchiveCandidateRecord,
} from './types.js';

export {
  parseAdvancedSearchResponse,
  parseScrapeResponse,
  hasNextScrapePage,
  parseMetadataResponse,
  buildAdvancedSearchUrl,
  buildScrapeUrl,
  buildMetadataUrl,
  type InternetArchiveScrapePage,
} from './client.js';

export {
  buildInternetArchiveCanonicalUrl,
  normalizeInternetArchiveDoc,
  normalizeInternetArchiveBatch,
  assertInternetArchiveCandidate,
  type NormalizeInternetArchiveDocInput,
} from './normalizer.js';

export { createInternetArchiveAdapterContract } from './contract.js';

export {
  fetchAdvancedSearch,
  fetchScrapeAll,
  fetchMetadata,
  type FetchAdvancedSearchInput,
  type FetchScrapeInput,
  type FetchMetadataInput,
} from './fetch-search.js';

export {
  DEFAULT_RETRYABLE_STATUSES,
  SafeHttpError,
  assertAllowedContentType,
  defaultIsRetryable,
  mapWithConcurrency,
  withRetry,
  type SafeHttpClient,
  type SafeHttpMethod,
  type SafeHttpRequest,
  type SafeHttpResponse,
  type RetryOptions,
} from './shared/http-port.js';

export {
  COMMUNITY_ADAPTER_KILL_SWITCH_PREFIX,
  communityAdapterKillSwitchId,
  parseCommunityAdapterKillSwitchId,
} from './shared/kill-switch.js';

export * from './wayback/index.js';
