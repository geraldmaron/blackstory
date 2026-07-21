/**
 * Gather-stage helpers for the research-directive loop: safe-fetch real page
 * text from seed URLs (authority leads, citation hrefs, corroboration targets)
 * instead of passing thin snippets or search-result blurbs to LLM judges.
 *
 * Uses the same DNS-pinned `runQuickAddFetch` path as research-intake — never
 * bare `fetch()` against URLs scraped from untrusted pages.
 */
import type { SafeFetchDependencies, SafeFetchResult } from '@repo/security/url-safety';
import { createNodeSafeFetchDependencies, runQuickAddFetch } from './fetch.js';
import { mapPool } from './map-pool.js';

const MAX_TEXT_CHARS = 4_000;
const MIN_USABLE_TEXT_CHARS = 100;

export type GatheredSourceSnippet = {
  readonly url: string;
  readonly text: string;
  readonly excerpt: string;
  readonly fetched: boolean;
  readonly finalUrl?: string;
};

export type GatherSourceSnippetsOptions = {
  readonly dependencies?: SafeFetchDependencies;
  readonly concurrency?: number;
  readonly maxChars?: number;
};

function clipText(text: string, maxChars: number): string {
  const trimmed = text.replace(/\s+/gu, ' ').trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

function excerptFromText(text: string, maxLength = 500): string {
  return clipText(text, maxLength);
}

/** Formats one gathered page for LLM prompt consumption (cite-bound, URL-labeled). */
export function formatGatheredSourceSnippet(snippet: GatheredSourceSnippet): string {
  const header = snippet.fetched
    ? `Source: ${snippet.finalUrl ?? snippet.url}`
    : `Source (prefetched): ${snippet.url}`;
  return `${header}\n${snippet.excerpt}`;
}

function okFetchToSnippet(
  url: string,
  result: Extract<SafeFetchResult, { ok: true }>,
  maxChars: number,
): GatheredSourceSnippet | undefined {
  const text = clipText(result.parser.extractedText, maxChars);
  if (text.length < MIN_USABLE_TEXT_CHARS) return undefined;
  return {
    url,
    finalUrl: result.finalUrl,
    text,
    excerpt: excerptFromText(text),
    fetched: true,
  };
}

/**
 * Fetches one URL through safe-fetch. Returns `undefined` when the URL is
 * rejected, unreachable, or too short — expected, not exceptional.
 */
export async function gatherSourceSnippet(
  url: string,
  dependencies: SafeFetchDependencies = createNodeSafeFetchDependencies(),
  maxChars = MAX_TEXT_CHARS,
): Promise<GatheredSourceSnippet | undefined> {
  const result = await runQuickAddFetch(url, dependencies);
  if (!result.ok || !result.parser.safe) return undefined;
  return okFetchToSnippet(url, result, maxChars);
}

/**
 * Wraps pre-fetched text (fixtures, cache replay) without network I/O.
 * Useful when a directive's plan stage already retrieved durable content.
 */
export function wrapPrefetchedSourceSnippet(
  url: string,
  text: string,
  maxChars = MAX_TEXT_CHARS,
): GatheredSourceSnippet | undefined {
  const clipped = clipText(text, maxChars);
  if (clipped.length < MIN_USABLE_TEXT_CHARS) return undefined;
  return {
    url,
    text: clipped,
    excerpt: excerptFromText(clipped),
    fetched: false,
  };
}

/** Dedupes URLs, fetches in bounded parallel, preserves input order for hits. */
export async function gatherSourceSnippetsFromUrls(
  urls: readonly string[],
  options: GatherSourceSnippetsOptions = {},
): Promise<readonly GatheredSourceSnippet[]> {
  const dependencies = options.dependencies ?? createNodeSafeFetchDependencies();
  const maxChars = options.maxChars ?? MAX_TEXT_CHARS;
  const concurrency = options.concurrency ?? 3;
  const seen = new Set<string>();
  const uniqueUrls: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    uniqueUrls.push(trimmed);
  }
  if (uniqueUrls.length === 0) return [];

  const results = await mapPool(
    uniqueUrls,
    (url) => gatherSourceSnippet(url, dependencies, maxChars),
    { concurrency },
  );
  return results.filter((snippet): snippet is GatheredSourceSnippet => snippet !== undefined);
}

/** Builds LLM-ready snippet strings from gathered pages. */
export function formatGatheredSourceSnippets(
  snippets: readonly GatheredSourceSnippet[],
): readonly string[] {
  return snippets.map(formatGatheredSourceSnippet);
}
