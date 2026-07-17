/**
 * Common Crawl retrospective discovery adapter types (BB-075).
 *
 * Common Crawl (AWS Open Data + Hugging Face mirrors) publishes its CDX capture index and
 * WARC/WAT/WET data under research/fair-use terms that already match this project's posture --
 * unlike the paid web-search leg (../web-search/), there is no storage-rights gate here (see the
 * bead's own research). The CDX Index Server is genuinely URL/host-pattern based, not a
 * full-text keyword search: it answers "what did Common Crawl capture under this host/URL
 * pattern, and when" across a given monthly/quarterly crawl (`crawlId`, e.g. "CC-MAIN-2016-07").
 * There is no CDX operation that greps page content for a name/place mention.
 *
 * This adapter therefore implements "name/place mentions" the way CDX actually supports it:
 * 1. Seed hosts are geographically labeled and must correspond to a `geographic` term already
 *    present in the driving BB-038 query pack (query-builder.ts
 *    `assertSeedGeographicLabelMatchesPack`) -- the place-relevance comes from *which* domain is
 *    queried, supplied by the campaign operator (mirrors ../rss/feed-registry.ts: this adapter
 *    does not invent domain names, it queries whatever seed hosts ops register).
 * 2. Within a seed host's captures, CDX's own `filter` parameter narrows to URLs whose path
 *    matches a regex built from the pack's public-safe positive/alias term text (never
 *    `researchOnlyOffensive` terms -- see query-builder.ts), which is the closest real "mention"
 *    signal CDX exposes without downloading WARC/WET bodies.
 */
import type { AdapterCandidateRecord } from '../types.js';

export const COMMON_CRAWL_ADAPTER_ID = 'common_crawl' as const;
export const COMMON_CRAWL_PARSER_VERSION = 'common-crawl-parser-1.0.0' as const;
export const COMMON_CRAWL_STABLE_ID_SCHEME = 'common-crawl-capture' as const;
export const COMMON_CRAWL_PAYLOAD_SCHEMA_VERSION = 'common-crawl-payload.v1' as const;

/** A retrospective crawl capture could be any kind of page -- same "review before trusting" posture as web-search. */
export const COMMON_CRAWL_DEFAULT_CLASSIFICATION = 'unknown' as const;

export const COMMON_CRAWL_INDEX_HOST = 'https://index.commoncrawl.org' as const;

export const COMMON_CRAWL_CDX_MATCH_TYPES = ['exact', 'prefix', 'host', 'domain'] as const;
export type CommonCrawlCdxMatchType = (typeof COMMON_CRAWL_CDX_MATCH_TYPES)[number];

/**
 * A campaign-operator-supplied seed target -- never invented by this adapter (see module doc
 * comment). `geographicLabel` must match a `geographic`-classed term in the driving query pack.
 */
export type CommonCrawlSeedTarget = {
  readonly host: string;
  readonly matchType: CommonCrawlCdxMatchType;
  readonly geographicLabel: string;
};

export type CommonCrawlQuery = {
  readonly crawlId: string;
  readonly seed: CommonCrawlSeedTarget;
  readonly limit: number;
  readonly filterPattern?: string;
  readonly page?: number;
};

export type CommonCrawlCdxRecord = {
  readonly urlkey: string;
  /** 14-digit YYYYMMDDHHMMSS capture timestamp. */
  readonly timestamp: string;
  readonly url: string;
  readonly mime?: string;
  readonly status?: string;
  readonly digest?: string;
  readonly length?: string;
  readonly filename?: string;
};

export type CommonCrawlRejectedRecord = {
  readonly index: number;
  readonly reason: string;
};

export type CommonCrawlParsedBatch = {
  readonly records: readonly CommonCrawlCdxRecord[];
  readonly rejected: readonly CommonCrawlRejectedRecord[];
};

/** Stamped on every external CDX query and every result it produces (bead acceptance criterion 5). */
export type CommonCrawlQueryProvenance = {
  readonly apiName: string;
  readonly queryText: string;
  readonly executedAt: string;
  readonly planTermsVersion: string;
};

export type CommonCrawlCandidatePayload = {
  readonly schemaVersion: typeof COMMON_CRAWL_PAYLOAD_SCHEMA_VERSION;
  readonly crawlId: string;
  readonly captureTimestamp: string;
  readonly query: CommonCrawlQueryProvenance;
  readonly mime?: string;
  readonly status?: string;
  readonly digest?: string;
  readonly geographicLabel: string;
  readonly filterPattern?: string;
};

export type CommonCrawlCandidateRecord = AdapterCandidateRecord & {
  readonly payload: CommonCrawlCandidatePayload;
};
