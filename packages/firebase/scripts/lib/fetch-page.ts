/**
 * Fetch-and-extract convenience wrapper for the research pipeline, on top of
 * `safe-fetch.ts` (the SSRF-safe, DNS-pinned transport every external fetch in
 * this pipeline must go through — see that module's doc for why a bare
 * `fetch()` is not safe here: these URLs are scraped from untrusted pages).
 *
 * Was three separate ad hoc `fetch()` + regex-strip implementations
 * (build-starter-enrichment-subjects.ts, build-discovery-enrichment-subjects.ts,
 * corroborate-source.ts) before this consolidation.
 */
import { safeFetchPage } from './safe-fetch.ts';

const MAX_TEXT_CHARS = 4_000;

export type FetchedPage = { readonly html: string; readonly text: string };

/** Every `<a href>` on the page, resolved to absolute URLs, deduped. Pure — no network. */
export function extractOutboundLinks(html: string, baseUrl: string): readonly string[] {
  const links = new Set<string>();
  const pattern = /<a\s[^>]*href=["']([^"'#]+)["']/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1]!, baseUrl).toString();
      if (resolved.startsWith('http')) links.add(resolved);
    } catch {
      // malformed href — skip
    }
  }
  return [...links];
}

/** Fetches `url`; returns both the raw HTML (for citation-trail extraction) and stripped text. */
export async function fetchPage(url: string): Promise<FetchedPage | undefined> {
  const page = await safeFetchPage(url);
  if (!page) return undefined;
  const text = page.text.slice(0, MAX_TEXT_CHARS);
  return text.length > 100 ? { html: page.html, text } : undefined;
}

/** Text-only convenience wrapper for callers that never need the citation trail. */
export async function fetchPageText(url: string): Promise<string | undefined> {
  const page = await fetchPage(url);
  return page?.text;
}
