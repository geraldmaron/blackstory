/**
 * Cross-reference step for the "gather" stage of the research pipeline: given
 * a subject with only one (often non-Tier-1) source, finds an independent
 * Tier-1 source about the SAME subject so a claim can build real multi-source
 * confidence (see lib/confidence.ts) instead of being stuck at whatever one
 * source happened to say.
 *
 * Two mechanisms, tried in order:
 *  1. Citation-trail: a source page (e.g. Wikipedia) usually lists its own
 *     references/external links. Extract them and check for a Tier-1 hit —
 *     this is how research actually works (follow the source's own citations
 *     to primary material) and is more precise than a blind web search: the
 *     page itself is asserting these are where its facts came from.
 *  2. SearXNG fallback: only when the source has no Tier-1 outbound link,
 *     search for one. Reuses the existing SearXNG client
 *     (packages/domain/src/adapters/web-search/searxng-client.ts) — not a new
 *     search implementation.
 *
 * Both mechanisms fetch through fetch-page.ts's safe-fetch (SSRF-safe,
 * DNS-pinned) — every URL here is scraped from an untrusted page or search
 * result. Best-effort throughout: SearXNG unreachable or zero Tier-1 hits
 * just means no corroboration was found, never an error.
 */
import { buildSearxngSearchUrl, parseSearxngSearchResponse } from '@repo/domain';
import { extractOutboundLinks, fetchPage } from './fetch-page.ts';
import { isTier1Host } from './tier1-sources.ts';

export type CorroboratingSource = {
  readonly url: string;
  readonly title?: string;
  readonly text: string;
  readonly method: 'citation_trail' | 'search';
};

/** Checks a fetched page's own outbound links for a reachable Tier-1 hit. */
async function findViaCitationTrail(html: string, baseUrl: string): Promise<CorroboratingSource | undefined> {
  const tier1Links = extractOutboundLinks(html, baseUrl).filter(isTier1Host);
  for (const link of tier1Links.slice(0, 3)) {
    const page = await fetchPage(link);
    if (page) return { url: link, text: page.text, method: 'citation_trail' };
  }
  return undefined;
}

async function findViaSearch(
  subjectName: string,
  searxngBaseUrl: string,
): Promise<CorroboratingSource | undefined> {
  try {
    const query = `"${subjectName}" (site:nps.gov OR site:loc.gov OR site:archives.gov OR site:si.edu OR site:census.gov)`;
    const searchUrl = buildSearxngSearchUrl({ baseUrl: searxngBaseUrl, query });
    // Fixed operator-configured endpoint, not attacker-controlled content — the
    // RESULT urls it returns are untrusted and go through fetchPage below.
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return undefined;
    const batch = parseSearxngSearchResponse(await response.json());
    const tier1Hit = batch.results.find((result) => isTier1Host(result.url));
    if (!tier1Hit) return undefined;
    const page = await fetchPage(tier1Hit.url);
    if (!page) return undefined;
    return { url: tier1Hit.url, ...(tier1Hit.title ? { title: tier1Hit.title } : {}), text: page.text, method: 'search' };
  } catch {
    return undefined;
  }
}

/**
 * Finds one independent Tier-1 source corroborating `subjectName`, preferring
 * the original source's own citation trail over a blind search. Returns
 * undefined on any failure — this is optional evidence-strengthening, never
 * a hard dependency of the pipeline it's called from.
 */
export async function findCorroboratingTier1Source(
  subjectName: string,
  originalSource: { readonly html?: string; readonly url?: string },
  options: { readonly searxngBaseUrl?: string } = {},
): Promise<CorroboratingSource | undefined> {
  if (originalSource.html && originalSource.url) {
    const viaCitation = await findViaCitationTrail(originalSource.html, originalSource.url);
    if (viaCitation) return viaCitation;
  }
  const baseUrl = options.searxngBaseUrl ?? process.env.SEARXNG_BASE_URL;
  if (!baseUrl) return undefined;
  return findViaSearch(subjectName, baseUrl);
}
