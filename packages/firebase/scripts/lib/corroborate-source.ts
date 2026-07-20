/**
 * Cross-reference step for the "gather" stage of the research pipeline: given
 * a subject with only one (often non-Tier-1) source, finds an independent
 * Tier-1 source about the SAME subject so a claim can build real multi-source
 * confidence (see lib/confidence.ts) instead of being stuck at whatever one
 * source happened to say.
 *
 * Mechanisms, tried in order:
 *  1. Wikipedia's own official Search API (`en.wikipedia.org/w/api.php`) —
 *     the SAME proven pattern discover-candidates.ts already uses for live
 *     discovery. Not rate-limited the way SearXNG's *scraped* "wikipedia
 *     engine" is: this hits Wikipedia's real API directly. Verified live
 *     while SearXNG's Wikipedia engine was itself suspended.
 *  2. Citation-trail: once we have ANY source page, it usually lists its own
 *     references/external links. Extract them and check for a Tier-1 hit —
 *     this is how research actually works (follow the source's own citations
 *     to primary material) and is more precise than a blind web search: the
 *     page itself is asserting these are where its facts came from. Doesn't
 *     touch SearXNG at all.
 *  3. SearXNG fallback: only when neither of the above found anything — the
 *     five free engines it proxies (Brave, DuckDuckGo, Google CSE, Startpage,
 *     Wikipedia-via-scrape) each enforce their own aggressive rate limits and
 *     go down together under real load; treat it as a last resort, not the
 *     primary path.
 *
 * All mechanisms fetch through fetch-page.ts's safe-fetch (SSRF-safe,
 * DNS-pinned) — every URL here is scraped from an untrusted page or search
 * result. Best-effort throughout: any step unreachable or empty just means no
 * corroboration was found there, never an error.
 */
import { buildSearxngSearchUrl, parseSearxngSearchResponse } from '@repo/domain';
import { extractOutboundLinks, fetchPage } from './fetch-page.ts';
import { isTier1Host } from './tier1-sources.ts';

const WIKIPEDIA_SEARCH_API = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_USER_AGENT = 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)';

type WikipediaSearchHit = { readonly title: string };

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'was', 'were',
  'is', 'are', 'that', 'this', 'from', 'as', 'its', 'it', 'be', 'been', 'his', 'her', 'their',
  'also', 'over', 'into', 'after', 'before', 'which', 'who', 'whom', 'has', 'have', 'had', 'not',
  'but', 'than', 'then', 'when', 'where', 'while', 'during', 'about', 'between', 'through',
  'under', 'above', 'both', 'more', 'most', 'some', 'such', 'only', 'own', 'same', 'because',
]);

function extractSignificantTerms(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gu, ' ')
      .split(/\s+/u)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
  );
}

/**
 * A person's own Wikipedia article never opens by describing itself as a place —
 * that phrasing is the signature of a SETTLEMENT article. Live incident: "Bill
 * Gilmer" (a lynching victim) got corroborated against "Gilmer, Texas" because
 * that town's own article happens to separately document an unrelated 1919
 * lynching, so the exact generic vocabulary every lynching-victim mention
 * context uses (county, mob, lynched, African American) coincidentally
 * overlapped enough to pass the old threshold below. A person subject citing a
 * page with this signature is a same-name collision with a place, not a match.
 */
const SETTLEMENT_SIGNATURE_RE = /\b(is a city in|is a town in|is a village in|county seat of|is an unincorporated|is a populated place|is a census-designated place)\b/iu;

export function looksLikeSettlementArticle(text: string): boolean {
  return SETTLEMENT_SIGNATURE_RE.test(text);
}

/**
 * Requires the candidate's own page TITLE to share at least one significant name
 * token with the subject — catches wrong-article matches driven purely by
 * thematic vocabulary overlap rather than the page actually being about someone
 * with this name. Live incidents this catches: "Slab Pitts" (a lynching victim)
 * corroborated against "Tulsa race massacre" (zero name overlap — matched purely
 * on shared lynching-narrative vocabulary), and "Anna M. Dumas" (a Reconstruction
 * postmaster) corroborated against "Minnie M. Cox" (a different, unrelated
 * postmaster whose own article happens to mention Dumas in passing, so the
 * context-overlap check below passed even though the article isn't about her).
 */
export function sharesNameToken(subjectName: string, candidateTitle: string): boolean {
  const nameTerms = extractSignificantTerms(subjectName);
  if (nameTerms.size === 0) return true;
  const titleTerms = extractSignificantTerms(candidateTitle);
  return [...nameTerms].some((term) => titleTerms.has(term));
}

/**
 * Disambiguation guard: Wikipedia's search API frequently resolves an ambiguous
 * or common name to the WRONG article — a same-named Secret Service director
 * instead of an 1870s landowner, an NFL tight end instead of a defunct 1880s
 * college. The subject's own name always trivially "matches" a wrong page that
 * happens to share it, so it's excluded from the comparison; the only real
 * signal is whether the record's own surrounding context (what it actually
 * says the subject did) shows up anywhere in the candidate page.
 */
export function isPlausibleMatch(
  subjectName: string,
  context: string | undefined,
  candidateText: string,
  candidateTitle: string,
  kind?: string,
): boolean {
  if (kind === 'person') {
    if (!sharesNameToken(subjectName, candidateTitle)) return false;
    if (looksLikeSettlementArticle(candidateText)) return false;
  }
  if (!context) return true;
  const nameTerms = extractSignificantTerms(subjectName);
  const contextTerms = [...extractSignificantTerms(context)].filter((term) => !nameTerms.has(term));
  if (contextTerms.length === 0) return true;
  const candidateLower = candidateText.toLowerCase();
  const matched = contextTerms.filter((term) => candidateLower.includes(term));
  const required = contextTerms.length <= 3 ? 1 : Math.ceil(contextTerms.length * 0.2);
  return matched.length >= required;
}

function buildContextQuery(subjectName: string, context: string | undefined): string {
  if (!context) return `"${subjectName}"`;
  const nameTerms = extractSignificantTerms(subjectName);
  const contextTerms = [...extractSignificantTerms(context)].filter((term) => !nameTerms.has(term)).slice(0, 6);
  return contextTerms.length > 0 ? `"${subjectName}" ${contextTerms.join(' ')}` : `"${subjectName}"`;
}

/** Wikipedia's own search API with retry/backoff — mirrors discover-candidates.ts's proven pattern. */
async function searchWikipediaApi(query: string, attempts = 3): Promise<readonly WikipediaSearchHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '5',
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
        const raw = (await response.json()) as { query?: { search?: readonly WikipediaSearchHit[] } };
        return raw.query?.search ?? [];
      }
      if (response.status !== 429 && response.status < 500) return [];
    } catch {
      // fall through to retry
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(8_000, 1_000 * 2 ** (attempt - 1))));
  }
  return [];
}

/**
 * Wikidata coordinates attached to the Wikipedia article, when the API has any.
 * Real for a specific place/located event (a plantation, a massacre site);
 * legitimately absent for an organization/law/movement with no single point —
 * that's correct, not a gap to paper over with a guessed geocode.
 */
async function fetchWikipediaCoordinates(title: string): Promise<{ lat: number; lng: number } | undefined> {
  try {
    const params = new URLSearchParams({ action: 'query', prop: 'coordinates', titles: title, format: 'json' });
    const response = await fetch(`${WIKIPEDIA_SEARCH_API}?${params.toString()}`, {
      headers: { 'User-Agent': WIKIPEDIA_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return undefined;
    const raw = (await response.json()) as {
      query?: { pages?: Record<string, { coordinates?: readonly { lat: number; lon: number }[] }> };
    };
    const page = Object.values(raw.query?.pages ?? {})[0];
    const coords = page?.coordinates?.[0];
    return coords ? { lat: coords.lat, lng: coords.lon } : undefined;
  } catch {
    return undefined;
  }
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

// Wikipedia's search API is forgiving of most "<State> State Capitol" queries via
// fuzzy matching, but a handful of states name their building something else
// entirely — override only those to avoid a wasted round-trip.
const STATE_CAPITOL_QUERY: Record<string, string> = {
  'South Carolina': 'South Carolina State House',
  Ohio: 'Ohio Statehouse',
  Massachusetts: 'Massachusetts State House',
  'New Hampshire': 'New Hampshire State House',
  Vermont: 'Vermont State House',
  Indiana: 'Indiana Statehouse',
};

/**
 * A bare state name, optionally with a ", United States"/", U.S." suffix — NOT
 * a "City, State" jurisdiction. Matching on substring-contains would wrongly
 * treat "New York, New York" (a CITY) as the state of New York and anchor it
 * to Albany instead of NYC — this only fires when the jurisdiction is exactly
 * the state itself, which is what locationPrecision === 'state' means.
 */
function extractBareUsState(jurisdictionLabel: string): string | undefined {
  const stripped = jurisdictionLabel.replace(/,\s*(United States|U\.S\.?)$/iu, '').trim();
  return US_STATES.find((state) => stripped === state);
}

/** Loose state match used ONLY to disambiguate a search query, never to decide behavior. */
function extractSearchDisambiguator(jurisdictionLabel: string): string {
  return US_STATES.find((state) => jurisdictionLabel.includes(state)) ?? 'United States';
}

/**
 * `query` alone is tried as an exact title first (works for well-known, unambiguous
 * names). The search fallback appends `disambiguator` (the subject's own state,
 * loosely) to the SEARCH query only — never to the direct title lookup — so a name
 * like "Lake City Public Library" doesn't silently resolve to a same-named place in
 * the wrong state; Wikipedia's own relevance ranking does the disambiguating work.
 */
async function resolveViaSearchThenCoordinates(
  query: string,
  disambiguator?: string,
): Promise<{ lat: number; lng: number } | undefined> {
  const direct = await fetchWikipediaCoordinates(query);
  if (direct) return direct;
  const searchQuery = disambiguator ? `${query} ${disambiguator}` : query;
  const hits = await searchWikipediaApi(searchQuery);
  for (const hit of hits.slice(0, 2)) {
    const coords = await fetchWikipediaCoordinates(hit.title);
    if (coords) return coords;
  }
  return undefined;
}

/**
 * Backfills real coordinates for a subject the judge already located in TEXT
 * (jurisdictionLabel/locationLabel) but whose own Wikipedia article has no
 * Wikidata coordinates — the common case for laws, government bodies, and
 * organizations with no single point of their own. Never guesses: every
 * candidate here is itself a real, separately-verifiable Wikipedia/Wikidata
 * lookup, just anchored to a different, more specific or more general subject
 * than the original one.
 *
 * Dispatches on locationPrecision, the judge's own signal for how specific the
 * location actually is — NOT on fuzzy string matching against the label text,
 * which is unreliable (e.g. "New York" is both a city and a state name):
 *  - institution/site/address/campus/building/stadium/airport/museum/district:
 *    a specific named place (headquarters, milestone event site) — resolve it
 *    directly; it often has its own geo-tagged article even when the subject
 *    doesn't.
 *  - state: the jurisdiction genuinely IS just a state (no more specific city
 *    given) — anchor to that state's capitol building, the "government
 *    center" convention for state-level laws/bodies.
 *  - country: genuinely national scope with no specific site — anchor to the
 *    U.S. Capitol, the federal government center.
 *  - anything else (city/county/neighborhood/town/region/campus/etc.): the
 *    label already names a specific-enough place — geocode it directly.
 */
// Generic descriptive words the judge sometimes fills in instead of an actual
// place name — searching these literally matches an unrelated same-named page
// (a real incident: "headquarters" alone matched an unrelated NY building
// instead of resolving to the subject's real Washington, D.C. jurisdiction).
const GENERIC_LOCATION_LABELS = new Set([
  'headquarters', 'corporate headquarters', 'site', 'location', 'campus', 'building',
  'office', 'offices', 'institution', 'address', 'facility',
]);

function isUsableLocationLabel(label: string): boolean {
  return label.trim().length > 0 && !GENERIC_LOCATION_LABELS.has(label.trim().toLowerCase());
}

export async function resolveGovernmentCenterCoordinates(
  jurisdictionLabel: string,
  locationLabel: string,
  locationPrecision: string,
): Promise<{ lat: number; lng: number } | undefined> {
  const disambiguator = extractSearchDisambiguator(jurisdictionLabel);
  const usableLocationLabel = isUsableLocationLabel(locationLabel) ? locationLabel : undefined;
  const SITE_PRECISIONS = new Set([
    'institution', 'site', 'address', 'campus', 'building', 'stadium', 'airport', 'museum', 'district',
  ]);
  if (usableLocationLabel && usableLocationLabel !== jurisdictionLabel && SITE_PRECISIONS.has(locationPrecision)) {
    const bySite = await resolveViaSearchThenCoordinates(usableLocationLabel, disambiguator);
    if (bySite) return bySite;
  }

  if (locationPrecision === 'state') {
    const state = extractBareUsState(jurisdictionLabel);
    if (state) {
      const byCapitol = await resolveViaSearchThenCoordinates(STATE_CAPITOL_QUERY[state] ?? `${state} State Capitol`);
      if (byCapitol) return byCapitol;
    }
  } else if (locationPrecision === 'country') {
    const byCapitol = await resolveViaSearchThenCoordinates('United States Capitol');
    if (byCapitol) return byCapitol;
  }

  return resolveViaSearchThenCoordinates(usableLocationLabel || jurisdictionLabel, disambiguator);
}

async function findViaWikipediaApi(
  subjectName: string,
  context?: string,
  kind?: string,
): Promise<CorroboratingSource | undefined> {
  const hits = await searchWikipediaApi(subjectName);
  for (const hit of hits) {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /gu, '_'))}`;
    const page = await fetchPage(url);
    if (!page) continue;
    if (!isPlausibleMatch(subjectName, context, page.text, hit.title, kind)) continue;
    const coordinates = await fetchWikipediaCoordinates(hit.title);
    return { url, title: hit.title, text: page.text, method: 'wikipedia_api', html: page.html, ...(coordinates ? { coordinates } : {}) };
  }
  return undefined;
}

export type CorroboratingSource = {
  readonly url: string;
  readonly title?: string;
  readonly text: string;
  readonly method: 'wikipedia_api' | 'citation_trail' | 'search';
  /** Raw HTML, when available, so a caller can citation-trail-follow this source too. */
  readonly html?: string;
  /** Wikidata coordinates, when the Wikipedia article has any (see fetchWikipediaCoordinates). */
  readonly coordinates?: { readonly lat: number; readonly lng: number };
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
  options: { readonly searxngBaseUrl?: string; readonly context?: string; readonly kind?: string } = {},
): Promise<CorroboratingSource | undefined> {
  const viaWikipedia = await findViaWikipediaApi(subjectName, options.context, options.kind);
  if (viaWikipedia) return viaWikipedia;
  const baseUrl = options.searxngBaseUrl ?? process.env.SEARXNG_BASE_URL;
  if (!baseUrl) return undefined;
  return searchAndFetch(buildContextQuery(subjectName, options.context), baseUrl, (results) => results[0]);
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
