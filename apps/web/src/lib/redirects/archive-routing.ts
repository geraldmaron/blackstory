/**
 * Where an old Archive address goes, in one hop (docs/ui/archive-url-contract.md, 10.3 and 10.4).
 *
 * The proxy calls both functions before query normalization, so the answer is already the
 * canonical `/archive` address and no second redirect follows. Every answer is temporary (307):
 * permanence waits on the owner watching production search and traffic.
 */
import { isPlatformPassthroughQueryKey } from '../runtime-hardening/constants';
import { buildNormalizedUrl } from '../runtime-hardening/query-normalization';
import { mapSearchQueryToRecordsHref } from '../search/search-href';
import { ARCHIVE_PATH } from '../records/records-query';
import { ARCHIVE_REDIRECTS_ENABLED } from './archive-redirects.mjs';
import { mapHistoryQueryToRecordsHref } from './history-href';

/** The books lens's own keys (contract section 7). `view=states` is no longer a view. */
const BOOKS_LENS_KEYS = ['q', 'state', 'author', 'sort', 'dir'] as const;

function bagOf(search: URLSearchParams): Record<string, string> {
  const bag: Record<string, string> = {};
  for (const key of new Set(search.keys())) bag[key] = search.get(key) ?? '';
  return bag;
}

/** `path?query`, canonicalized for its own path, with the platform's handshake keys kept. */
function canonical(origin: URL, path: string, query: URLSearchParams): string {
  // A query copied from the request already holds them; a mapped one (`/search`) does not.
  const held = new Set(query.keys());
  for (const [key, value] of origin.searchParams) {
    if (isPlatformPassthroughQueryKey(key) && !held.has(key)) query.append(key, value);
  }
  const url = buildNormalizedUrl(new URL(`${path}?${query}`, origin));
  return `${url.pathname}${url.search}`;
}

/** The query of an href another module already mapped onto the list's vocabulary. */
function queryOf(href: string): URLSearchParams {
  return new URLSearchParams(href.split('?')[1] ?? '');
}

/**
 * The `/archive` address for a retired one, or null when the path is not one or the switch is
 * off. `/collections` is outside the switch: its page is deleted, so it always lands on the
 * Archive, whose lens chips replaced it.
 */
export function legacyArchiveRedirect(
  url: URL,
  enabled = ARCHIVE_REDIRECTS_ENABLED,
): string | null {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  if (path === '/collections') return ARCHIVE_PATH;
  // `/story` was the retelling on trial; it is the front page now (docs/ui/DESIGN.md 9.7).
  if (path === '/story') return '/';
  if (!enabled) return null;
  const query = new URLSearchParams(url.search);
  if (path === '/records') {
    // On the list `view` only ever spelled the timeline; it must not open the map from here.
    if (query.get('view') === 'map') query.delete('view');
    return canonical(url, ARCHIVE_PATH, query);
  }
  if (path === '/explore') {
    query.set('view', 'map');
    return canonical(url, ARCHIVE_PATH, query);
  }
  if (path === '/search') {
    return canonical(url, ARCHIVE_PATH, queryOf(mapSearchQueryToRecordsHref(bagOf(query))));
  }
  if (path === '/history') {
    return canonical(url, ARCHIVE_PATH, queryOf(mapHistoryQueryToRecordsHref(bagOf(query))));
  }
  return null;
}

/**
 * `/archive?lens=`: the law and books lenses answer on `/law` and `/books`, which are their own
 * canonical addresses, and the presidents are a story collection. `lens=inventions` is a filter
 * on the shared model: it moves to `kind=inventions` here, temporarily like the rest, so the
 * `/archive` normalizer never answers it with a permanent redirect.
 */
export function archiveLensRedirect(url: URL): string | null {
  if (url.pathname !== ARCHIVE_PATH) return null;
  const lens = url.searchParams.get('lens')?.trim().toLowerCase();
  if (lens === 'law') return canonical(url, '/law', new URLSearchParams(url.search));
  if (lens === 'presidents') return '/presidents';
  if (lens === 'inventions') {
    const query = new URLSearchParams(url.search);
    query.delete('lens');
    query.set('kind', 'inventions');
    return canonical(url, ARCHIVE_PATH, query);
  }
  if (lens === 'books') {
    const query = new URLSearchParams();
    for (const key of BOOKS_LENS_KEYS) {
      const value = url.searchParams.get(key)?.trim();
      if (value) query.set(key, value);
    }
    return query.size > 0 ? `/books?${query}` : '/books';
  }
  return null;
}
