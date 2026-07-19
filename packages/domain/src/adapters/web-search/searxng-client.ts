/**
 * SearXNG JSON search API request/response handling (self-hosted meta-search).
 *
 * Endpoint shape: GET {baseUrl}/search?q=…&format=json
 * Optional shared-secret auth via Authorization header when the operator puts a
 * reverse-proxy token in front of the instance — never required for a Tailscale-only
 * Corsair deployment. Parsing is defensive: a missing `results` array or bad row
 * degrades one hit, never the whole batch.
 */
import type { WebSearchParsedBatch, WebSearchRawResult } from './types.js';

export const SEARXNG_DEFAULT_PATH = '/search' as const;

export type BuildSearxngSearchUrlInput = {
  /** Origin only, e.g. http://100.119.72.84:8888 — no trailing path required. */
  readonly baseUrl: string;
  readonly query: string;
  readonly categories?: string;
  readonly language?: string;
  readonly pageno?: number;
};

export function normalizeSearxngBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('SearXNG base URL is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`SearXNG base URL is invalid: ${baseUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SearXNG base URL must be http(s): ${baseUrl}`);
  }
  return trimmed;
}

export function buildSearxngSearchUrl(input: BuildSearxngSearchUrlInput): string {
  if (!input.query.trim()) {
    throw new Error('SearXNG search query text is required');
  }
  const base = normalizeSearxngBaseUrl(input.baseUrl);
  const params = new URLSearchParams({
    q: input.query,
    format: 'json',
    categories: input.categories ?? 'general',
    language: input.language ?? 'en',
    pageno: String(input.pageno ?? 1),
  });
  return `${base}${SEARXNG_DEFAULT_PATH}?${params.toString()}`;
}

function parseResult(
  raw: unknown,
  index: number,
):
  | { readonly result: WebSearchRawResult }
  | { readonly rejected: { readonly index: number; readonly reason: string } } {
  if (!raw || typeof raw !== 'object') {
    return { rejected: { index, reason: 'not_an_object' } };
  }
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url.trim() : undefined;
  if (!url) {
    return { rejected: { index, reason: 'missing_url' } };
  }
  const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : undefined;
  // SearXNG uses `content` for the snippet; tolerate `description` aliases.
  const descriptionRaw =
    typeof record.content === 'string'
      ? record.content
      : typeof record.description === 'string'
        ? record.description
        : undefined;
  const description =
    descriptionRaw !== undefined && descriptionRaw.trim() ? descriptionRaw.trim() : undefined;
  const pageAge =
    typeof record.publishedDate === 'string'
      ? record.publishedDate
      : typeof record.pubdate === 'string'
        ? record.pubdate
        : undefined;

  return {
    result: {
      ...(title !== undefined ? { title } : {}),
      url,
      ...(description !== undefined ? { description } : {}),
      ...(pageAge !== undefined ? { pageAge } : {}),
    },
  };
}

/** Parses a SearXNG `format=json` response defensively; `results` may be absent. */
export function parseSearxngSearchResponse(raw: unknown): WebSearchParsedBatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('SearXNG search response must be an object');
  }
  const record = raw as Record<string, unknown>;
  const rawResults = Array.isArray(record.results) ? record.results : [];

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
