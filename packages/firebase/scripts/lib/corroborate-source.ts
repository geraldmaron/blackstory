/**
 * Cross-reference step for the "gather" stage of the research pipeline: given
 * a subject with only one (often non-Tier-1) source, finds an independent
 * corroborating source about the SAME subject so a claim can build real
 * multi-source confidence (see lib/confidence.ts) instead of being stuck at
 * whatever one source happened to say.
 *
 * Mechanisms, tried in order:
 *  1. Citation-trail on the primary source page — outbound `<a href>` links and
 *     inline http(s) URLs, filtered to Tier-1 hosts and rejecting same-lineage
 *     links as the primary (historicsites.dcpreservation.org → nps.gov, etc.).
 *  2. Wikipedia bridge → Tier-1 trail — Wikipedia's own Search API finds a
 *     secondary article, then its outbound Tier-1 references become the
 *     corroboration (Wikipedia itself is never returned as evidence).
 *  3. SearXNG fallback — Tier-1-restricted web search aligned with isTier1Host
 *     (.gov / .mil / si.edu plus preferred NPS/LoC/planning.dc.gov hosts).
 *  4. Tier-2 citation-trail — curated reputable_secondary hosts when Tier-1
 *     fails (dcpreservation.org, hmdb.org, dclibrary.org, blackpast.org).
 *  5. Tier-2 SearXNG — same curated secondary hosts, different hostname only.
 *
 * All mechanisms fetch through fetch-page.ts's safe-fetch (SSRF-safe,
 * DNS-pinned) — every URL here is scraped from an untrusted page or search
 * result. Best-effort throughout: any step unreachable or empty just means no
 * corroboration was found there, never an error.
 */
import { buildSearxngSearchUrl, parseSearxngSearchResponse } from '@repo/domain';
import { collectTier1TrailLinks, collectTier2TrailLinks } from './citation-trail.ts';
import { fetchPage } from './fetch-page.ts';
import {
  hostLineageKey,
  isReputableSecondaryHost,
  isTier1Host,
  isWikipediaHost,
  rankTier1Links,
  REPUTABLE_SECONDARY_HOST_SUFFIXES,
} from './tier1-sources.ts';

const WIKIPEDIA_SEARCH_API = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_USER_AGENT = 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)';
const MAX_TRAIL_FETCHES = 5;

/** Preferred federal/archive hosts — ranked first in citation-trail and search picks. */
const PREFERRED_TIER1_SITES = [
  'nps.gov',
  'loc.gov',
  'planning.dc.gov',
  'archives.gov',
  'si.edu',
  'census.gov',
] as const;

type WikipediaSearchHit = { readonly title: string };

export type CorroboratingSource = {
  readonly url: string;
  readonly title?: string;
  readonly text: string;
  readonly method:
    | 'wikipedia_api'
    | 'citation_trail'
    | 'search'
    | 'tier2_citation_trail'
    | 'tier2_search';
  /** Raw HTML, when available, so a caller can citation-trail-follow this source too. */
  readonly html?: string;
};

/** Tier-1 SearXNG query — broad .gov/.mil/si.edu coverage plus preferred archive hosts. */
export function buildTier1SearxngQuery(subjectName: string): string {
  const siteClauses = [
    ...PREFERRED_TIER1_SITES.map((site) => `site:${site}`),
    'site:.gov',
    'site:.mil',
    'site:si.edu',
  ];
  return `"${subjectName}" (${siteClauses.join(' OR ')})`;
}

/** Tier-2 SearXNG query — curated reputable_secondary hosts only. */
export function buildTier2SearxngQuery(subjectName: string): string {
  const siteClauses = REPUTABLE_SECONDARY_HOST_SUFFIXES.map((site) => `site:${site}`);
  return `"${subjectName}" (${siteClauses.join(' OR ')})`;
}

/** Wikipedia's own search API with retry/backoff — mirrors discover-candidates.ts's proven pattern. */
async function searchWikipediaApi(
  query: string,
  attempts = 3,
): Promise<readonly WikipediaSearchHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '3',
    format: 'json',
    origin: '*',
  });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${WIKIPEDIA_SEARCH_API}?${params.toString()}`, {
        headers: { 'User-Agent': WIKIPEDIA_USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const raw = (await response.json()) as {
          query?: { search?: readonly WikipediaSearchHit[] };
        };
        return raw.query?.search ?? [];
      }
      if (response.status !== 429 && response.status < 500) return [];
    } catch {
      // fall through to retry
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(8_000, 1_000 * 2 ** (attempt - 1))),
    );
  }
  return [];
}

async function findViaWikipediaApi(subjectName: string): Promise<CorroboratingSource | undefined> {
  const hits = await searchWikipediaApi(subjectName);
  const first = hits[0];
  if (!first) return undefined;
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(first.title.replace(/ /gu, '_'))}`;
  const page = await fetchPage(url);
  if (!page) return undefined;
  return { url, title: first.title, text: page.text, method: 'wikipedia_api', html: page.html };
}

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

async function fetchFirstReachableLink(
  links: readonly string[],
  method: CorroboratingSource['method'],
): Promise<CorroboratingSource | undefined> {
  for (const link of links.slice(0, MAX_TRAIL_FETCHES)) {
    const page = await fetchPage(link);
    if (page) return { url: link, text: page.text, method, html: page.html };
  }
  return undefined;
}

/** Checks a fetched page's outbound and inline links for a reachable Tier-1 hit. */
async function findViaCitationTrail(
  html: string,
  baseUrl: string,
  excludeUrls: readonly string[] = [],
  text?: string,
): Promise<CorroboratingSource | undefined> {
  const tier1Links = collectTier1TrailLinks(html, baseUrl, { excludeUrls, ...(text ? { text } : {}) });
  return fetchFirstReachableLink(tier1Links, 'citation_trail');
}

/** Tier-2 citation-trail on the primary page — curated secondary hosts only. */
async function findViaTier2CitationTrail(
  html: string,
  baseUrl: string,
  excludeUrls: readonly string[] = [],
  text?: string,
): Promise<CorroboratingSource | undefined> {
  const tier2Links = collectTier2TrailLinks(html, baseUrl, { excludeUrls, ...(text ? { text } : {}) });
  return fetchFirstReachableLink(tier2Links, 'tier2_citation_trail');
}

/**
 * Uses Wikipedia as a secondary bridge only: find the article, follow its own
 * Tier-1 outbound references, never return Wikipedia itself as corroboration.
 */
async function findViaWikipediaTier1Trail(
  subjectName: string,
  excludeUrls: readonly string[],
): Promise<CorroboratingSource | undefined> {
  const viaWikipedia = await findViaWikipediaApi(subjectName);
  if (!viaWikipedia?.html) return undefined;
  const tier1Links = collectTier1TrailLinks(viaWikipedia.html, viaWikipedia.url, {
    excludeUrls: [...excludeUrls, viaWikipedia.url],
    text: viaWikipedia.text,
  });
  const corroboration = await fetchFirstReachableLink(tier1Links, 'citation_trail');
  if (!corroboration) return undefined;
  if (hostLineageKey(corroboration.url) === hostLineageKey(viaWikipedia.url)) return undefined;
  return corroboration;
}

type SearchHit = { readonly url: string; readonly title?: string };

function excludeHostSet(excludeUrls: readonly string[]): Set<string> {
  return new Set(
    excludeUrls.map(hostLineageKey).filter((host): host is string => host !== undefined),
  );
}

/** Picks the best-ranked independent Tier-1 search hit, preferring NPS/LoC/planning.dc.gov. */
export function pickIndependentTier1SearchHit(
  results: readonly SearchHit[],
  excludeUrls: readonly string[] = [],
): SearchHit | undefined {
  const excludeHosts = excludeHostSet(excludeUrls);
  const eligible = results.filter((result) => {
    if (!isTier1Host(result.url)) return false;
    const host = hostLineageKey(result.url);
    return host !== undefined && !excludeHosts.has(host);
  });
  const rankedUrls = rankTier1Links(eligible.map((result) => result.url));
  const bestUrl = rankedUrls[0];
  if (!bestUrl) return undefined;
  return eligible.find((result) => result.url === bestUrl) ?? { url: bestUrl };
}

/** Picks the first independent curated secondary hit; rejects Wikipedia and same-lineage hosts. */
export function pickIndependentTier2SearchHit(
  results: readonly SearchHit[],
  excludeUrls: readonly string[] = [],
): SearchHit | undefined {
  const excludeHosts = excludeHostSet(excludeUrls);
  return results.find((result) => {
    if (isWikipediaHost(result.url)) return false;
    if (!isReputableSecondaryHost(result.url)) return false;
    const host = hostLineageKey(result.url);
    return host !== undefined && !excludeHosts.has(host);
  });
}

async function searchAndFetch(
  query: string,
  searxngBaseUrl: string,
  pick: (results: readonly SearchHit[]) => SearchHit | undefined,
  method: CorroboratingSource['method'],
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
  return {
    url: hit.url,
    ...(hit.title ? { title: hit.title } : {}),
    text: page.text,
    method,
  };
}

async function findViaTier1Search(
  subjectName: string,
  searxngBaseUrl: string,
  excludeUrls: readonly string[] = [],
): Promise<CorroboratingSource | undefined> {
  return searchAndFetch(
    buildTier1SearxngQuery(subjectName),
    searxngBaseUrl,
    (results) => pickIndependentTier1SearchHit(results, excludeUrls),
    'search',
  );
}

async function findViaTier2Search(
  subjectName: string,
  searxngBaseUrl: string,
  excludeUrls: readonly string[] = [],
): Promise<CorroboratingSource | undefined> {
  return searchAndFetch(
    buildTier2SearxngQuery(subjectName),
    searxngBaseUrl,
    (results) => pickIndependentTier2SearchHit(results, excludeUrls),
    'tier2_search',
  );
}

/**
 * Finds ANY source for a subject with no known page yet — e.g. a gap-fill
 * candidate discovered only as a name mentioned in another record's claim.
 * Used as the PRIMARY lookup for such subjects, distinct from
 * `findCorroboratingTier1Source` (which assumes a starting source already
 * exists and looks for a second, independent one). Tries Wikipedia's own API
 * first (reliable, not SearXNG-rate-limited); only falls back to a broad
 * SearXNG search if the subject has no Wikipedia article.
 */
export async function findAnySource(
  subjectName: string,
  options: { readonly searxngBaseUrl?: string } = {},
): Promise<CorroboratingSource | undefined> {
  const viaWikipedia = await findViaWikipediaApi(subjectName);
  if (viaWikipedia) return viaWikipedia;
  const baseUrl = options.searxngBaseUrl ?? process.env.SEARXNG_BASE_URL;
  if (!baseUrl) return undefined;
  return searchAndFetch(`"${subjectName}"`, baseUrl, (results) => results[0], 'search');
}

/**
 * Finds one independent corroborating source for `subjectName`, preferring
 * Tier-1 (citation trail → Wikipedia bridge → Tier-1 search) and falling back
 * to curated Tier-2 secondary hosts when Tier-1 is unavailable. Returns
 * undefined on any failure — optional evidence-strengthening, never a hard
 * dependency of the pipeline it's called from.
 */
export async function findCorroboratingTier1Source(
  subjectName: string,
  originalSource: { readonly html?: string; readonly url?: string; readonly text?: string },
  options: { readonly searxngBaseUrl?: string } = {},
): Promise<CorroboratingSource | undefined> {
  const excludeUrls = originalSource.url ? [originalSource.url] : [];

  if (originalSource.html && originalSource.url) {
    const viaPrimaryTrail = await findViaCitationTrail(
      originalSource.html,
      originalSource.url,
      excludeUrls,
      originalSource.text,
    );
    if (viaPrimaryTrail) return viaPrimaryTrail;
  }

  const viaWikipediaTrail = await findViaWikipediaTier1Trail(subjectName, excludeUrls);
  if (viaWikipediaTrail) return viaWikipediaTrail;

  const baseUrl = options.searxngBaseUrl ?? process.env.SEARXNG_BASE_URL;

  if (baseUrl) {
    const viaTier1Search = await findViaTier1Search(subjectName, baseUrl, excludeUrls);
    if (viaTier1Search) return viaTier1Search;
  }

  if (originalSource.html && originalSource.url) {
    const viaTier2Trail = await findViaTier2CitationTrail(
      originalSource.html,
      originalSource.url,
      excludeUrls,
      originalSource.text,
    );
    if (viaTier2Trail) return viaTier2Trail;
  }

  if (!baseUrl) return undefined;
  return findViaTier2Search(subjectName, baseUrl, excludeUrls);
}

export { collectTier1TrailLinks, collectTier2TrailLinks } from './citation-trail.ts';
export {
  hostLineageKey,
  isReputableSecondaryHost,
  isSameLineageHost,
  isTier1Host,
  isWikipediaHost,
  REPUTABLE_SECONDARY_HOST_SUFFIXES,
} from './tier1-sources.ts';
