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

/**
 * SearXNG's own local capacity isn't the constraint — its upstream engines
 * (Brave, DuckDuckGo, Google CSE, Startpage, Wikipedia) each enforce their
 * OWN rate limits and will suspend within seconds of a concurrent burst,
 * however many mapPool workers are calling this concurrently. A single
 * healthy poll before a batch is not a reliable signal the engines can
 * sustain that batch — observed directly: one query returned 19 results,
 * then a 182-candidate run immediately re-suspended every engine. So every
 * SearXNG query in this process is serialized through one queue with a hard
 * minimum spacing, independent of caller concurrency.
 */
const SEARXNG_MIN_SPACING_MS = 4_000;
let searxngQueue: Promise<void> = Promise.resolve();

function throttledSearxngCall<T>(run: () => Promise<T>): Promise<T> {
  const result = searxngQueue.then(run);
  searxngQueue = result
    .then(() => undefined)
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, SEARXNG_MIN_SPACING_MS)));
  return result;
}

/** Checks a fetched page's own outbound links for a reachable Tier-1 hit. */
async function findViaCitationTrail(html: string, baseUrl: string): Promise<CorroboratingSource | undefined> {
  const tier1Links = extractOutboundLinks(html, baseUrl).filter(isTier1Host);
  for (const link of tier1Links.slice(0, 3)) {
    const page = await fetchPage(link);
    if (page) return { url: link, text: page.text, method: 'citation_trail' };
  }
  return undefined;
}

async function searchAndFetch(
  query: string,
  searxngBaseUrl: string,
  pick: (results: readonly { readonly url: string; readonly title?: string }[]) => { readonly url: string; readonly title?: string } | undefined,
): Promise<CorroboratingSource | undefined> {
  const hit = await throttledSearxngCall(async () => {
    try {
      const searchUrl = buildSearxngSearchUrl({ baseUrl: searxngBaseUrl, query });
      // Fixed operator-configured endpoint, not attacker-controlled content — the
      // RESULT urls it returns are untrusted and go through fetchPage below.
      const response = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return undefined;
      const batch = parseSearxngSearchResponse(await response.json());
      return pick(batch.results);
    } catch {
      return undefined;
    }
  });
  if (!hit) return undefined;
  const page = await fetchPage(hit.url);
  if (!page) return undefined;
  return { url: hit.url, ...(hit.title ? { title: hit.title } : {}), text: page.text, method: 'search' };
}

async function findViaSearch(subjectName: string, searxngBaseUrl: string): Promise<CorroboratingSource | undefined> {
  const query = `"${subjectName}" (site:nps.gov OR site:loc.gov OR site:archives.gov OR site:si.edu OR site:census.gov)`;
  return searchAndFetch(query, searxngBaseUrl, (results) => results.find((r) => isTier1Host(r.url)));
}

/**
 * Broad (non-Tier-1-restricted) search for a subject with no known source at
 * all yet — e.g. a gap-fill candidate discovered only as a name mentioned in
 * another record's claim, not from a page of its own. Used as the PRIMARY
 * lookup for such subjects, distinct from `findCorroboratingTier1Source`
 * (which assumes a starting source already exists and looks for a second,
 * independent one).
 */
export async function findAnySource(
  subjectName: string,
  options: { readonly searxngBaseUrl?: string } = {},
): Promise<CorroboratingSource | undefined> {
  const baseUrl = options.searxngBaseUrl ?? process.env.SEARXNG_BASE_URL;
  if (!baseUrl) return undefined;
  return searchAndFetch(`"${subjectName}"`, baseUrl, (results) => results[0]);
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
