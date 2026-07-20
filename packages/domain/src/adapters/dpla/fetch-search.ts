/**
 * Fetches DPLA v2 search results through the safe HTTP port. Never calls
 * `fetch` directly see ../internet-archive/shared/http-port.ts for why. The API key is always
 * supplied by the caller (`DPLA_API_KEY`, see .env.example); this module never reads an
 * environment variable or hardcodes a key itself; tests pass a deterministic fake key.
 */
import {
  assertAllowedContentType,
  defaultIsRetryable,
  withRetry,
  type SafeHttpClient,
} from '../internet-archive/shared/http-port.js';
import type { SourceRegistryEntry } from '../types.js';
import { buildDplaSearchUrl, parseDplaSearchResponse } from './client.js';
import { normalizeDplaBatch } from './normalizer.js';
import type { DplaCandidateRecord } from './types.js';

const DPLA_ALLOWED_CONTENT_TYPES = ['application/json', 'text/json'];

export type FetchDplaSearchInput = {
  readonly query: string;
  readonly apiKey: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly registryEntry: SourceRegistryEntry;
  readonly runId: string;
  readonly capturedAt: string;
  readonly client: SafeHttpClient;
  readonly retries?: number;
  readonly classification?: string;
};

export async function fetchDplaSearch(
  input: FetchDplaSearchInput,
): Promise<readonly DplaCandidateRecord[]> {
  if (!input.apiKey.trim()) {
    throw new Error('DPLA_API_KEY is required — see .env.example (never hardcode a key)');
  }
  const url = buildDplaSearchUrl({
    query: input.query,
    apiKey: input.apiKey,
    ...(input.page !== undefined ? { page: input.page } : {}),
    ...(input.pageSize !== undefined ? { pageSize: input.pageSize } : {}),
  });
  const response = await withRetry(
    () => input.client({ url, method: 'GET', allowedContentTypes: DPLA_ALLOWED_CONTENT_TYPES }),
    { retries: input.retries ?? 3, baseDelayMs: 250, isRetryable: defaultIsRetryable },
  );
  assertAllowedContentType(response, DPLA_ALLOWED_CONTENT_TYPES);
  const raw = JSON.parse(response.bodyText) as unknown;
  const batch = parseDplaSearchResponse(raw);
  return normalizeDplaBatch({
    docs: batch.docs,
    registryEntry: input.registryEntry,
    runId: input.runId,
    capturedAt: input.capturedAt,
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
  });
}
