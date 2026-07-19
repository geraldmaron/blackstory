/**
 * RSS/Atom discovery adapter types.
 * Publisher-syndicated feeds are the lowest-risk, cheapest community channel: publishers
 * deliberately push title + link + summary for syndication, so storing that trio is low-risk
 * by design (see ../../rights/evidence-pointer.ts for the snippet-cap doctrine this still obeys).
 */
import type { AdapterCandidateRecord } from '../types.js';

export const RSS_ADAPTER_ID = 'rss' as const;
export const RSS_PARSER_VERSION = 'rss-parser-1.0.0' as const;
export const RSS_STABLE_ID_SCHEME = 'rss-item' as const;
export const RSS_PAYLOAD_SCHEMA_VERSION = 'rss-payload.v1' as const;

/**
 * The constitution's low-authority source tiers this maps community feeds onto
 * (packages/schemas/constitution/policy.v1.json `sourceClassifications`). A feed registry
 * entry picks the tier that best matches its publisher type; see feed-registry.ts.
 */
export const RSS_FEED_CLASSIFICATIONS = ['news_reportage', 'self_published', 'community_oral'] as const;

export type RssFeedClassification = (typeof RSS_FEED_CLASSIFICATIONS)[number];

export const RSS_FEED_INSTITUTION_TYPES = [
  'historical_society',
  'museum',
  'library',
  'university_digital_collection',
  'personal_blog',
  'other',
] as const;

export type RssFeedInstitutionType = (typeof RSS_FEED_INSTITUTION_TYPES)[number];

export type ParsedFeedFormat = 'rss' | 'atom';

export type ParsedFeedItem = {
  readonly title?: string;
  readonly link?: string;
  readonly guid?: string;
  /** Description/summary text, entity-decoded and whitespace-collapsed; not HTML. */
  readonly summary?: string;
  /** ISO 8601 when parseable from pubDate/updated/published; otherwise the raw string. */
  readonly publishedAt?: string;
  /**
   * HTTPS/HTTP hrefs extracted from item HTML (description/content:encoded) before stripping.
   * URLs only — never a full article body. Used for authority follow-up harvest.
   */
  readonly linkHints?: readonly string[];
};

export type ParsedFeed = {
  readonly format: ParsedFeedFormat;
  readonly channelTitle?: string;
  readonly items: readonly ParsedFeedItem[];
};

export type RssCandidatePayload = {
  readonly schemaVersion: typeof RSS_PAYLOAD_SCHEMA_VERSION;
  readonly feedId: string;
  readonly feedUrl: string;
  readonly feedFormat: ParsedFeedFormat;
  readonly itemGuid?: string;
  /** Capped to the evidence-pointer snippet limits never a full article body. */
  readonly summary?: string;
  readonly publishedAt?: string;
  readonly classification: RssFeedClassification;
  /** Outbound hrefs from the feed item (capped); for authority harvest, not republication. */
  readonly outboundLinkHints?: readonly string[];
};

export type RssCandidateRecord = AdapterCandidateRecord & {
  readonly payload: RssCandidatePayload;
};
