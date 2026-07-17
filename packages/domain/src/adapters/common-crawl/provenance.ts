/**
 * Provenance stamping for every external Common Crawl CDX query and the results it produces
 * (BB-075 acceptance criterion 5): API name, query text, timestamp, and plan/terms version.
 */
import type { CommonCrawlQuery, CommonCrawlQueryProvenance } from './types.js';

export const COMMON_CRAWL_API_NAME = 'Common Crawl CDX Index' as const;
export const COMMON_CRAWL_TERMS_VERSION = 'common-crawl-research-fair-use-2026' as const;

export function describeCommonCrawlQuery(query: CommonCrawlQuery): string {
  const parts = [
    `crawlId=${query.crawlId}`,
    `host=${query.seed.host}`,
    `matchType=${query.seed.matchType}`,
    `geographicLabel=${query.seed.geographicLabel}`,
    `limit=${query.limit}`,
  ];
  if (query.filterPattern !== undefined) {
    parts.push(`filter=${query.filterPattern}`);
  }
  if (query.page !== undefined) {
    parts.push(`page=${query.page}`);
  }
  return parts.join(' ');
}

export function stampCommonCrawlQueryProvenance(input: {
  readonly query: CommonCrawlQuery;
  readonly executedAt: string;
  readonly planTermsVersion?: string;
}): CommonCrawlQueryProvenance {
  if (!input.executedAt.trim()) {
    throw new Error('Common Crawl query provenance requires executedAt');
  }
  const queryText = describeCommonCrawlQuery(input.query);
  if (!queryText.trim()) {
    throw new Error('Common Crawl query provenance requires a non-empty queryText');
  }
  const planTermsVersion = (input.planTermsVersion ?? COMMON_CRAWL_TERMS_VERSION).trim();
  if (!planTermsVersion) {
    throw new Error('Common Crawl query provenance requires a planTermsVersion');
  }
  return {
    apiName: COMMON_CRAWL_API_NAME,
    queryText,
    executedAt: input.executedAt,
    planTermsVersion,
  };
}
