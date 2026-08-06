/**
 * repo-n7p6.3 (WS3) — English Wikipedia collector.
 *
 * The NRHP nomination form is the deepest source but it only exists for NRHP places. Persons,
 * organizations, and the non-NRHP lanes need a second source, and Wikipedia is the one with
 * broad coverage, a stable API, and a licence we can actually carry (CC BY-SA 4.0, recorded in
 * provenance on every row so WS4's output can be attributed).
 *
 * Two rules from the WS3 spec are enforced here rather than left to the caller:
 *
 *   1. Search snippets are NEVER evidence. Search is used only to pick a title; the article is
 *      then fetched in full via prop=extracts and that fetched prose is what gets stored. The
 *      domain adapter states the same rule (assertSearchSnippetsNotCopied) — this collector is
 *      the fetch-side half of it.
 *
 *   2. Identity is corroborated, not assumed. Wikipedia search will confidently return
 *      *something* for any query, and a wrong article is worse than no article: it produces
 *      fluent, plausible, well-cited history about the wrong subject. So a candidate article is
 *      rejected unless its text corroborates the place we already know from the registry row.
 */
import { WIKIMEDIA_USER_AGENT } from '@repo/domain';

const API = 'https://en.wikipedia.org/w/api.php';

/** Wikipedia text is CC BY-SA 4.0; stored verbatim, so the licence travels with the row. */
export const WIKIPEDIA_LICENCE = 'CC BY-SA 4.0';

export type WikipediaArticle = {
  readonly title: string;
  readonly url: string;
  readonly extract: string;
  readonly pageId: number;
};

export type WikipediaLookupInput = {
  readonly displayName: string;
  readonly city?: string;
  readonly county?: string;
  readonly state?: string;
  readonly fetchImpl?: typeof fetch;
};

async function apiGet(params: Record<string, string>, fetchImpl: typeof fetch): Promise<unknown> {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' }).toString()}`;
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status} for ${params['action']}`);
  return response.json();
}

/**
 * Roster names are stored inverted for filing ("Jude, George, House"; "Wells, Ida B., House").
 * Searching that string verbatim finds nothing, so it is un-inverted before querying — this is
 * the single highest-yield transformation for the NRHP lane, where most names are filed that way.
 */
export function searchQueryFromDisplayName(displayName: string, place?: string): string {
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  // "Jude, George, House" -> "George Jude House": trailing type word, then given name, then surname.
  const reordered =
    parts.length >= 3 ? [parts[1], parts[0], ...parts.slice(2)].join(' ') : parts.join(' ');
  return [reordered, place].filter(Boolean).join(' ');
}

type SearchHit = { readonly title: string; readonly pageid: number };

function readSearchHits(raw: unknown): readonly SearchHit[] {
  const search = (raw as { query?: { search?: unknown } } | null)?.query?.search;
  if (!Array.isArray(search)) return [];
  return search.flatMap((hit) => {
    const title = (hit as { title?: unknown }).title;
    const pageid = (hit as { pageid?: unknown }).pageid;
    return typeof title === 'string' && typeof pageid === 'number' ? [{ title, pageid }] : [];
  });
}

function readExtract(raw: unknown): { readonly extract: string; readonly title: string } | null {
  const pages = (raw as { query?: { pages?: Record<string, unknown> } } | null)?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    const extract = (page as { extract?: unknown }).extract;
    const title = (page as { title?: unknown }).title;
    if (typeof extract === 'string' && typeof title === 'string' && extract.trim().length > 0) {
      return { extract, title };
    }
  }
  return null;
}

/**
 * Does this article actually corroborate the registry row's place? Same discipline as the
 * nomination identity gate: a fluent article about the wrong subject is the failure mode that
 * costs us most, so place has to agree before the text is allowed to become evidence.
 */
export function articleCorroboratesPlace(
  extract: string,
  input: Pick<WikipediaLookupInput, 'city' | 'county' | 'state'>,
): boolean {
  const haystack = extract.toLowerCase();
  const candidates = [input.city, input.county, input.state]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => value !== undefined && value.length > 0);
  if (candidates.length === 0) return false;
  // State alone is weak but is all some rows have; city or county agreement is the strong signal.
  return candidates.some((value) => haystack.includes(value));
}

/**
 * Fetch a specific article by exact title, no search and no place corroboration. For rows whose
 * identity is already anchored elsewhere — a person-kind landscape candidate discovered FROM a
 * Wikidata QID, whose canonicalUrl already points at the matching enwiki article — re-deriving
 * identity via place-text search would be redundant at best and would wrongly reject persons
 * with no city/county/state in payload at all (`articleCorroboratesPlace` requires at least one).
 * Returns null only when the title does not resolve to any article.
 */
export async function lookupWikipediaArticleByTitle(
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WikipediaArticle | null> {
  const extractRaw = await apiGet(
    { action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'plain', titles: title },
    fetchImpl,
  );
  const found = readExtract(extractRaw);
  if (found === null) return null;
  return {
    title: found.title,
    // pageid isn't in this response shape (no pageids requested); callers that need it should
    // use lookupWikipediaArticle instead. 0 marks "not fetched" rather than a real page id.
    pageId: 0,
    extract: found.extract,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(found.title.replace(/ /gu, '_'))}`,
  };
}

/**
 * Find and fetch the best-matching article, or null when nothing corroborates. Checks the top
 * few hits rather than only the first: for NRHP names the exact property often ranks below a
 * more famous namesake, and the place check is what tells them apart.
 */
export async function lookupWikipediaArticle(
  input: WikipediaLookupInput,
): Promise<WikipediaArticle | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const place = [input.city, input.state].filter(Boolean).join(' ');
  const query = searchQueryFromDisplayName(input.displayName, place);

  const searchRaw = await apiGet(
    { action: 'query', list: 'search', srsearch: query, srlimit: '5' },
    fetchImpl,
  );
  const hits = readSearchHits(searchRaw);
  if (hits.length === 0) return null;

  for (const hit of hits.slice(0, 3)) {
    const extractRaw = await apiGet(
      {
        action: 'query',
        prop: 'extracts',
        explaintext: '1',
        exsectionformat: 'plain',
        titles: hit.title,
      },
      fetchImpl,
    );
    const found = readExtract(extractRaw);
    if (found === null) continue;
    if (!articleCorroboratesPlace(found.extract, input)) continue;
    return {
      title: found.title,
      pageId: hit.pageid,
      extract: found.extract,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(found.title.replace(/ /gu, '_'))}`,
    };
  }
  return null;
}
