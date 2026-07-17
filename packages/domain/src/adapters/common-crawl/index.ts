/**
 * Common Crawl retrospective discovery adapter public surface (BB-075). Free (AWS Open Data +
 * Hugging Face), no storage-rights gate -- see ./types.ts's module doc comment for how "CDX-index
 * query construction for name/place mentions" is implemented given CDX is URL/host-pattern based,
 * not full-text search.
 */
export {
  COMMON_CRAWL_ADAPTER_ID,
  COMMON_CRAWL_PARSER_VERSION,
  COMMON_CRAWL_STABLE_ID_SCHEME,
  COMMON_CRAWL_PAYLOAD_SCHEMA_VERSION,
  COMMON_CRAWL_DEFAULT_CLASSIFICATION,
  COMMON_CRAWL_INDEX_HOST,
  COMMON_CRAWL_CDX_MATCH_TYPES,
  type CommonCrawlCdxMatchType,
  type CommonCrawlSeedTarget,
  type CommonCrawlQuery,
  type CommonCrawlCdxRecord,
  type CommonCrawlRejectedRecord,
  type CommonCrawlParsedBatch,
  type CommonCrawlCandidatePayload,
  type CommonCrawlCandidateRecord,
  type CommonCrawlQueryProvenance,
} from './types.js';

export {
  buildCdxIndexUrl,
  buildCdxIndexUrlFromQuery,
  parseCdxResponse,
  type BuildCdxIndexUrlInput,
} from './client.js';

export {
  buildCommonCrawlFilterPattern,
  assertSeedGeographicLabelMatchesPack,
  assertFilterPatternHasNoResearchOnlyOffensiveTerms,
  buildCommonCrawlQueries,
  type BuildCommonCrawlQueriesInput,
} from './query-builder.js';

export {
  COMMON_CRAWL_API_NAME,
  COMMON_CRAWL_TERMS_VERSION,
  describeCommonCrawlQuery,
  stampCommonCrawlQueryProvenance,
} from './provenance.js';

export {
  normalizeCdxRecord,
  normalizeCdxBatch,
  assertCommonCrawlCandidate,
  type NormalizeCdxRecordInput,
} from './normalizer.js';

export { createCommonCrawlAdapterContract } from './contract.js';

export {
  fetchCommonCrawlCdx,
  fetchCommonCrawlCdxBatch,
  type FetchCommonCrawlCdxInput,
} from './fetch-cdx.js';

export {
  ingestCommonCrawlCandidatesThroughPipeline,
  type IngestCommonCrawlCandidatesThroughPipelineInput,
} from './pipeline.js';
