/**
 * Common Crawl CDX Index Server request/response handling (BB-075). Builds
 * `https://index.commoncrawl.org/<crawlId>-index` query URLs and parses the newline-delimited
 * JSON (NDJSON) response defensively. CDX also returns a plain-text `No captures found for ...`
 * body (not JSON, sometimes with a non-200 status) when a host/pattern has zero captures in a
 * given crawl -- that is treated as zero records, not an error, since "no captures for this seed
 * in this crawl" is an expected, common outcome, not a malformed response.
 */
import type { CommonCrawlCdxMatchType, CommonCrawlParsedBatch, CommonCrawlQuery, CommonCrawlSeedTarget } from './types.js';
import { COMMON_CRAWL_INDEX_HOST } from './types.js';

export type BuildCdxIndexUrlInput = {
  readonly crawlId: string;
  readonly seed: CommonCrawlSeedTarget;
  readonly limit?: number;
  readonly filterPattern?: string;
  readonly page?: number;
};

function assertMatchType(matchType: CommonCrawlCdxMatchType): void {
  if (matchType !== 'exact' && matchType !== 'prefix' && matchType !== 'host' && matchType !== 'domain') {
    throw new Error(`Unknown Common Crawl CDX matchType: ${matchType}`);
  }
}

export function buildCdxIndexUrl(input: BuildCdxIndexUrlInput): string {
  if (!input.crawlId.trim()) {
    throw new Error('Common Crawl crawlId is required (e.g. "CC-MAIN-2016-07")');
  }
  if (!input.seed.host.trim()) {
    throw new Error('Common Crawl seed host is required');
  }
  assertMatchType(input.seed.matchType);

  const params = new URLSearchParams({
    url: input.seed.host,
    output: 'json',
    matchType: input.seed.matchType,
    limit: String(input.limit ?? 1000),
  });
  if (input.filterPattern) {
    params.set('filter', `~url:${input.filterPattern}`);
  }
  if (input.page !== undefined) {
    params.set('page', String(input.page));
  }
  return `${COMMON_CRAWL_INDEX_HOST}/${encodeURIComponent(input.crawlId)}-index?${params.toString()}`;
}

export function buildCdxIndexUrlFromQuery(query: CommonCrawlQuery): string {
  return buildCdxIndexUrl({
    crawlId: query.crawlId,
    seed: query.seed,
    limit: query.limit,
    ...(query.filterPattern !== undefined ? { filterPattern: query.filterPattern } : {}),
    ...(query.page !== undefined ? { page: query.page } : {}),
  });
}

const NO_CAPTURES_PREFIX = 'no captures found';

/** Parses a CDX NDJSON response body defensively; a malformed line is rejected, not thrown. */
export function parseCdxResponse(raw: string): CommonCrawlParsedBatch {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith(NO_CAPTURES_PREFIX)) {
    return { records: [], rejected: [] };
  }

  const lines = trimmed.split('\n').filter((line) => line.trim().length > 0);
  const records: CommonCrawlParsedBatch['records'][number][] = [];
  const rejected: CommonCrawlParsedBatch['rejected'][number][] = [];

  lines.forEach((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      rejected.push({ index, reason: 'invalid_json' });
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      rejected.push({ index, reason: 'not_an_object' });
      return;
    }
    const record = parsed as Record<string, unknown>;
    const urlkey = typeof record.urlkey === 'string' ? record.urlkey : undefined;
    const timestamp = typeof record.timestamp === 'string' ? record.timestamp : undefined;
    const url = typeof record.url === 'string' ? record.url : undefined;
    if (!urlkey || !timestamp || !url) {
      rejected.push({ index, reason: 'missing_required_field' });
      return;
    }
    records.push({
      urlkey,
      timestamp,
      url,
      ...(typeof record.mime === 'string' ? { mime: record.mime } : {}),
      ...(typeof record.status === 'string' ? { status: record.status } : {}),
      ...(typeof record.digest === 'string' ? { digest: record.digest } : {}),
      ...(typeof record.length === 'string' ? { length: record.length } : {}),
      ...(typeof record.filename === 'string' ? { filename: record.filename } : {}),
    });
  });

  return { records, rejected };
}
