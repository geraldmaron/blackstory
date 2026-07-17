/**
 * Fetches Internet Archive Advanced Search Scrape Metadata results through the safe
 * HTTP port. Never calls `fetch` directly see shared/http-port.ts for why.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
} from './shared/http-port.js';
import type { SourceRegistryEntry } from '../types.js';
import {
  buildAdvancedSearchUrl,
  buildMetadataUrl,
  buildScrapeUrl,
  parseAdvancedSearchResponse,
  parseMetadataResponse,
  parseScrapeResponse,
} from './client.js';
import { normalizeInternetArchiveBatch, normalizeInternetArchiveDoc } from './normalizer.js';
import type { InternetArchiveCandidateRecord } from './types.js';

const IA_ALLOWED_CONTENT_TYPES = ['application/json', 'text/json', 'text/plain'];

async function getJson(client: SafeHttpClient, url: string, retries: number): Promise<unknown> {
  const response = await withRetry(() => client({ url, method: 'GET', allowedContentTypes: IA_ALLOWED_CONTENT_TYPES }), {
    retries,
    baseDelayMs: 250,
    isRetryable: defaultIsRetryable,
  });
  assertAllowedContentType(response, IA_ALLOWED_CONTENT_TYPES);
  return JSON.parse(response.bodyText) as unknown;
}

export type FetchAdvancedSearchInput = {
  readonly query: string;
  readonly rows?: number;
  readonly page?: number;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
};

export async function fetchAdvancedSearch(
  input: FetchAdvancedSearchInput,
): Promise<readonly InternetArchiveCandidateRecord[]> {
  const url = buildAdvancedSearchUrl(input.query, input.rows ?? 50, input.page ?? 1);
  const raw = await getJson(input.client, url, input.retries ?? 3);
  const batch = parseAdvancedSearchResponse(raw);
  return normalizeInternetArchiveBatch({
    docs: batch.docs,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
  });
}

export type FetchScrapeInput = {
  readonly query: string;
  readonly count?: number;
  readonly maxPages?: number;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
};

/** Cursor-based Scrape API pagination: follows `cursor` until absent or `maxPages` is reached. */
export async function fetchScrapeAll(input: FetchScrapeInput): Promise<readonly InternetArchiveCandidateRecord[]> {
  const results: InternetArchiveCandidateRecord[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const maxPages = input.maxPages ?? 20;

  do {
    const url = buildScrapeUrl(input.query, input.count ?? 1000, cursor);
    const raw = await getJson(input.client, url, input.retries ?? 3);
    const page = parseScrapeResponse(raw);
    results.push(
      ...normalizeInternetArchiveBatch({
        docs: page.docs,
        registryEntry: input.registryEntry,
        runId: input.runId,
        capturedAt: input.capturedAt,
        ...(input.classification !== undefined ? { classification: input.classification } : {}),
      }),
    );
    cursor = page.cursor;
    pages += 1;
  } while (cursor !== undefined && pages < maxPages);

  return results;
}

export type FetchMetadataInput = {
  readonly identifier: string;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
};

export async function fetchMetadata(input: FetchMetadataInput): Promise<InternetArchiveCandidateRecord | undefined> {
  const url = buildMetadataUrl(input.identifier);
  const raw = await getJson(input.client, url, input.retries ?? 3);
  const doc = parseMetadataResponse(raw);
  if (!doc) return undefined;
  return normalizeInternetArchiveDoc({
    doc,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
  });
}
