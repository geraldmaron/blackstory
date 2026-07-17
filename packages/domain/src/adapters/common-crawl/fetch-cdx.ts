/**
 * Fetches Common Crawl CDX index results through the safe HTTP port. Never calls
 * `fetch` directly -- see ../internet-archive/shared/http-port.ts for why.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  mapWithConcurrency,
  withRetry,
  type SafeHttpClient,
} from '../internet-archive/shared/http-port.js';
import type { SourceRegistryEntry } from '../types.js';
import { buildCdxIndexUrlFromQuery, parseCdxResponse } from './client.js';
import { normalizeCdxBatch } from './normalizer.js';
import { stampCommonCrawlQueryProvenance } from './provenance.js';
import type { CommonCrawlCandidateRecord, CommonCrawlQuery } from './types.js';

// CDX has been observed to report `application/json` for its own metadata/collinfo endpoints but
// NDJSON (one JSON object per line) for -index queries under `text/plain` or `text/x-ndjson`
// depending on server config; tolerate all three rather than fail closed on a content-type quirk
// that carries no security implication (unlike executeSafeFetch's HTML/script rejection).
const CDX_ALLOWED_CONTENT_TYPES = ['application/json', 'text/x-ndjson', 'text/plain'];

export type FetchCommonCrawlCdxInput = {
  readonly query: CommonCrawlQuery;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
};

export async function fetchCommonCrawlCdx(input: FetchCommonCrawlCdxInput): Promise<readonly CommonCrawlCandidateRecord[]> {
  const url = buildCdxIndexUrlFromQuery(input.query);
  const response = await withRetry(
    () => input.client({ url, method: 'GET', allowedContentTypes: CDX_ALLOWED_CONTENT_TYPES }),
    { retries: input.retries ?? 3, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, CDX_ALLOWED_CONTENT_TYPES);
  const batch = parseCdxResponse(response.bodyText);
  const queryProvenance = stampCommonCrawlQueryProvenance({
    query: input.query,
    executedAt: input.capturedAt,
  });

  return normalizeCdxBatch({
    records: batch.records,
    crawlId: input.query.crawlId,
    geographicLabel: input.query.seed.geographicLabel,
    queryProvenance,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
    ...(input.query.filterPattern !== undefined ? { filterPattern: input.query.filterPattern } : {}),
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
  });
}

export async function fetchCommonCrawlCdxBatch(input: {
  readonly queries: readonly CommonCrawlQuery[];
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
  readonly concurrency?: number;
}): Promise<readonly CommonCrawlCandidateRecord[]> {
  const results = await mapWithConcurrency(input.queries, input.concurrency ?? 3, (query) =>
    fetchCommonCrawlCdx({
      query,
      registryEntry: input.registryEntry,
      runId: input.runId,
      capturedAt: input.capturedAt,
      client: input.client,
      ...(input.retries !== undefined ? { retries: input.retries } : {}),
      ...(input.classification !== undefined ? { classification: input.classification } : {}),
    }),
  );
  return results.flat();
}
