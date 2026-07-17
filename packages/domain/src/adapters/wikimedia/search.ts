/**
 * MediaWiki search parsing for fixture-driven discovery (BB-045). No live network in tests.
 */
import type { MediaWikiSearchHit, MediaWikiSearchResponse } from './types.js';

export function parseMediaWikiSearchResponse(raw: unknown): readonly MediaWikiSearchHit[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('MediaWiki search response must be an object');
  }
  const response = raw as MediaWikiSearchResponse;
  const hits = response.query?.search ?? [];
  return hits.map((hit) => ({
    pageid: hit.pageid,
    title: hit.title,
    ...(hit.snippet !== undefined ? { snippet: hit.snippet } : {}),
  }));
}

export function searchHitPageIds(hits: readonly MediaWikiSearchHit[]): readonly number[] {
  return hits.map((hit) => hit.pageid);
}

/** Search snippets are discovery hints only — never copied into candidate prose by default. */
export function assertSearchSnippetsNotCopied(payload: Readonly<Record<string, unknown>>): void {
  if ('extract' in payload || 'prose' in payload || 'snippet' in payload) {
    throw new Error('Wikipedia prose or search snippets must not be copied into candidate payload');
  }
}
