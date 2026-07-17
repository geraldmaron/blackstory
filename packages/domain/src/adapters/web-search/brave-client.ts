/**
 * Brave Web Search API request/response handling (BB-075).
 *
 * Endpoint and auth shape follow Brave's documented Web Search API contract: GET
 * https://api.search.brave.com/res/v1/web/search?q=... with the API key passed as the
 * `X-Subscription-Token` header (never as a query param, so it never leaks into logs/URLs or
 * request-cache keys). This has not been exercised against a live endpoint — no real key exists
 * in this environment, deliberately (see ./provider-decision.ts and ../normalizer.ts's
 * storage-terms gate) — so verify the exact field names against Brave's current docs before
 * flipping the adapter out of `disabled`/canary. Response parsing is defensive (tolerant of a
 * missing `web.results` array or missing per-result fields), in the same spirit as
 * ../dpla/client.ts's tolerance for DPLA's shape churn: a field rename should degrade one result,
 * never poison the whole batch or throw.
 */
import type { WebSearchParsedBatch, WebSearchRawResult } from './types.js';

export const BRAVE_WEB_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search' as const;
export const BRAVE_API_KEY_HEADER = 'X-Subscription-Token' as const;

export type BuildBraveSearchUrlInput = {
  readonly query: string;
  readonly count?: number;
  readonly offset?: number;
  readonly country?: string;
};

export function buildBraveWebSearchUrl(input: BuildBraveSearchUrlInput): string {
  if (!input.query.trim()) {
    throw new Error('Brave web search query text is required');
  }
  const params = new URLSearchParams({
    q: input.query,
    count: String(input.count ?? 20),
    offset: String(input.offset ?? 0),
  });
  if (input.country) {
    params.set('country', input.country);
  }
  return `${BRAVE_WEB_SEARCH_ENDPOINT}?${params.toString()}`;
}

function parseResult(
  raw: unknown,
  index: number,
): { readonly result: WebSearchRawResult } | { readonly rejected: { readonly index: number; readonly reason: string } } {
  if (!raw || typeof raw !== 'object') {
    return { rejected: { index, reason: 'not_an_object' } };
  }
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url.trim() : undefined;
  if (!url) {
    return { rejected: { index, reason: 'missing_url' } };
  }
  const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined;
  const description =
    typeof record.description === 'string' && record.description.trim() ? record.description.trim() : undefined;
  const pageAge =
    typeof record.page_age === 'string' ? record.page_age : typeof record.age === 'string' ? record.age : undefined;

  return {
    result: {
      ...(title !== undefined ? { title } : {}),
      url,
      ...(description !== undefined ? { description } : {}),
      ...(pageAge !== undefined ? { pageAge } : {}),
    },
  };
}

/** Parses a Brave `/res/v1/web/search` JSON response defensively; `web.results` may be absent. */
export function parseBraveSearchResponse(raw: unknown): WebSearchParsedBatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Brave web search response must be an object');
  }
  const record = raw as Record<string, unknown>;
  const web = record.web && typeof record.web === 'object' ? (record.web as Record<string, unknown>) : undefined;
  const rawResults = web && Array.isArray(web.results) ? web.results : [];

  const results: WebSearchRawResult[] = [];
  const rejected: { index: number; reason: string }[] = [];
  rawResults.forEach((item, index) => {
    const parsed = parseResult(item, index);
    if ('result' in parsed) {
      results.push(parsed.result);
    } else {
      rejected.push(parsed.rejected);
    }
  });

  return { results, rejected };
}
