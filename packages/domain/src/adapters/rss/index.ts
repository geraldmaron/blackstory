/**
 * RSS/Atom community discovery adapter public surface (BB-073).
 */
export {
  RSS_ADAPTER_ID,
  RSS_PARSER_VERSION,
  RSS_STABLE_ID_SCHEME,
  RSS_PAYLOAD_SCHEMA_VERSION,
  RSS_FEED_CLASSIFICATIONS,
  RSS_FEED_INSTITUTION_TYPES,
  type RssFeedClassification,
  type RssFeedInstitutionType,
  type ParsedFeedFormat,
  type ParsedFeedItem,
  type ParsedFeed,
  type RssCandidatePayload,
  type RssCandidateRecord,
} from './types.js';

export { parseRssOrAtomFeed } from './parser.js';

export {
  FEED_REGISTRY_SCHEMA_VERSION,
  createInMemoryFeedRegistry,
  addFeedToRegistry,
  removeFeedFromRegistry,
  listActiveFeeds,
  createInMemoryAuditLog,
  type FeedRegistryEntry,
  type FeedRegistryEntryStatus,
  type FeedRegistryStore,
  type AddFeedInput,
  type FeedRegistryMutationResult,
  type InMemoryAuditLog,
} from './feed-registry.js';

export { RSS_ATTRIBUTION_NOTICE, createRssAdapterContract } from './contract.js';

export {
  capSyndicatedSummary,
  normalizeFeedItem,
  normalizeFeedXml,
  assertRssCandidate,
  type NormalizeFeedItemInput,
} from './normalizer.js';

export { fetchAndNormalizeFeed, fetchAndNormalizeFeeds, type FetchFeedInput } from './fetch-feed.js';
