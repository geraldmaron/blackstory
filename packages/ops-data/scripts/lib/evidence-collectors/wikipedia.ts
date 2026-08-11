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
 *      rejected unless it clears the shared identity gate in `subject-identity.ts`.
 *
 *      That gate replaced this module's own place-only check in repo-ppeu. The place-only check
 *      accepted an article if ANY ONE of city/county/state appeared, which is how "First Baptist
 *      Church of Covington, Virginia" was given the article for Covington, KENTUCKY, and how a
 *      house in Virginia was given an article about a Virginia election. Search picks the
 *      candidate; identity — place AND name AND focus — decides whether it becomes evidence.
 */
import { WIKIMEDIA_USER_AGENT } from '@repo/domain';
import {
  checkSubjectIdentity,
  isDisambiguationExtract,
  type SubjectIdentity,
} from './subject-identity.ts';

export { isDisambiguationExtract };

const API = 'https://en.wikipedia.org/w/api.php';

/** Wikipedia text is CC BY-SA 4.0; stored verbatim, so the licence travels with the row. */
export const WIKIPEDIA_LICENCE = 'CC BY-SA 4.0';

export type WikipediaArticle = {
  readonly title: string;
  readonly url: string;
  readonly extract: string;
  readonly pageId: number;
  /**
   * How this article was tied to the row. Undefined for the title-fetch path, whose identity is
   * anchored by the row's own canonicalUrl rather than derived from the text. Recorded on the
   * evidence row so a later audit can see which gates a capture passed without refetching.
   */
  readonly identity?: SubjectIdentity;
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
 * Does this article actually corroborate the row — place, name, and focus? Thin wrapper over the
 * shared gate, present so the collector reads in its own vocabulary and so the article's TITLE
 * takes part in the check (it is what identifies a listings/index page).
 */
export function articleCorroboratesSubject(
  extract: string,
  title: string,
  input: Pick<WikipediaLookupInput, 'displayName' | 'city' | 'county' | 'state'>,
): SubjectIdentity {
  return checkSubjectIdentity(extract, input, { title });
}

/**
 * Fetch a specific article by exact title, no search and no place corroboration. For rows whose
 * identity is already anchored elsewhere — a person-kind landscape candidate discovered FROM a
 * Wikidata QID, whose canonicalUrl already points at the matching enwiki article — re-deriving
 * identity from the article text would be redundant at best and would wrongly reject persons with
 * no city/county/state in payload at all (the shared gate requires place agreement).
 * Returns null only when the title does not resolve to any article.
 */
export async function lookupWikipediaArticleByTitle(
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WikipediaArticle | null> {
  const extractRaw = await apiGet(
    {
      action: 'query',
      prop: 'extracts',
      explaintext: '1',
      exsectionformat: 'plain',
      titles: title,
    },
    fetchImpl,
  );
  const found = readExtract(extractRaw);
  if (found === null) return null;
  // No place-corroboration loop to fall through to here (unlike lookupWikipediaArticle) — this
  // is a direct title fetch, so a disambiguation page must be rejected outright rather than
  // silently accepted as identity-anchored content.
  if (isDisambiguationExtract(found.extract)) return null;
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
    const identity = articleCorroboratesSubject(found.extract, found.title, input);
    if (!identity.corroborated) continue;
    return {
      title: found.title,
      pageId: hit.pageid,
      extract: found.extract,
      identity,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(found.title.replace(/ /gu, '_'))}`,
    };
  }
  return null;
}
