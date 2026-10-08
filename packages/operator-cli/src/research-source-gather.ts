/**
 * Gather-stage helpers for the research-directive loop: safe-fetch real page
 * text from seed URLs (authority leads, citation hrefs, corroboration targets)
 * instead of passing thin snippets or search-result blurbs to LLM judges.
 *
 * Uses the same DNS-pinned `runQuickAddFetch` path as research-intake — never
 * bare `fetch()` against URLs scraped from untrusted pages.
 */
import type { SafeFetchDependencies, SafeFetchResult } from '@repo/security/url-safety';
import { dedupeUrlsByPage, lookupSourceTier, urlDedupeKey } from '@repo/domain';
import { createNodeSafeFetchDependencies, runQuickAddFetch } from './fetch.js';
import { mapPool } from './map-pool.js';

const MAX_TEXT_CHARS = 100_000;
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

/**
 * Formats one gathered page for LLM prompt consumption (cite-bound, URL-labeled). Tags the
 * source tier so the judge sees trust level before drafting claims, using
 * the same registry every surface consults (@repo/domain's lookupSourceTier) — not a parallel
 * enrichment-only classifier.
 */
export function formatGatheredSourceSnippet(snippet: GatheredSourceSnippet, seeking = ''): string {
  const url = snippet.finalUrl ?? snippet.url;
  const tier = lookupSourceTier(url).tier;
  const header = snippet.fetched
    ? `Source (Tier: ${tier}): ${url}`
    : `Source (prefetched, Tier: ${tier}): ${snippet.url}`;
  return `${header}\n${selectSourcePassages(snippet.text, seeking)}`;
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

/**
 * Dedupes by page, fetches in bounded parallel, preserves input order for hits.
 *
 * Deduped TWICE, on purpose, because one page can hide behind two different strings at two
 * different moments:
 *
 *  1. Before fetching, on a canonical page key rather than the raw string. `https://nps.gov/x` and
 *     `https://NPS.gov/x?utm_source=y` are one page, and a raw-string key would fetch it twice and
 *     return two snippets.
 *  2. After fetching, on `finalUrl`. Two genuinely different URLs can redirect to one document, and
 *     no canonicalization before the request can know that — only the response can.
 *
 * Duplicate counting is not untidiness here. Independence is the entire basis of corroboration, and
 * a duplicate that looks independent is worse than an obvious one.
 */
export async function gatherSourceSnippetsFromUrls(
  urls: readonly string[],
  options: GatherSourceSnippetsOptions = {},
): Promise<readonly GatheredSourceSnippet[]> {
  const dependencies = options.dependencies ?? createNodeSafeFetchDependencies();
  const maxChars = options.maxChars ?? MAX_TEXT_CHARS;
  const concurrency = options.concurrency ?? 3;
  const uniqueUrls = dedupeUrlsByPage(urls);
  if (uniqueUrls.length === 0) return [];

  const results = await mapPool(
    uniqueUrls,
    (url) => gatherSourceSnippet(url, dependencies, maxChars),
    { concurrency },
  );

  const seenPages = new Set<string>();
  const deduped: GatheredSourceSnippet[] = [];
  for (const snippet of results) {
    if (snippet === undefined) continue;
    // The redirect target is what was actually read, so it is what identity is judged on.
    const key = urlDedupeKey(snippet.finalUrl ?? snippet.url) ?? `raw:${snippet.url}`;
    if (seenPages.has(key)) continue;
    seenPages.add(key);
    deduped.push(snippet);
  }
  return deduped;
}

/** Builds LLM-ready snippet strings from gathered pages. */
export function formatGatheredSourceSnippets(
  snippets: readonly GatheredSourceSnippet[],
): readonly string[] {
  return snippets.map((snippet) => formatGatheredSourceSnippet(snippet));
}

/** Select bounded passages across the document, preserving exact text rather than a navigation prefix. */
export function selectSourcePassages(text: string, seeking: string, maxChars = 16000): string {
  if (text.length <= maxChars) return text;
  const terms = [...new Set(seeking.toLowerCase().match(/[a-z0-9]{4,}/gu) ?? [])];
  const windows: { start: number; text: string; score: number }[] = [];
  for (let start = 0; start < text.length; start += 1000) {
    const passage = text.slice(start, start + 1200);
    const lower = passage.toLowerCase();
    windows.push({
      start,
      text: passage,
      score: terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0),
    });
  }
  const selected = windows
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, Math.max(1, Math.floor(maxChars / 1250)))
    .sort((a, b) => a.start - b.start);
  return selected
    .map(
      (window) =>
        `[Characters ${window.start}-${window.start + window.text.length}]\n${window.text}`,
    )
    .join('\n[Passage break]\n');
}
