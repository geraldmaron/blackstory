/**
 * The `/stories` index's pure logic: query parsing, href building, filtering, sorting,
 * windowing, header facts, the rail groups and the three notice states.
 *
 * A story is one long-form publication, and `kind` says under which editorial contract:
 * `chapter` (era-immersion, prose floor) or `article` (a record entry — a paragraph of
 * context plus individually cited call-outs). Both live in one index because a reader
 * looking for what the archive says about a subject should not have to know which
 * contract the answer was written under.
 *
 * Filtering, sorting and search are all URL state — no client-side store. Every control
 * is a link or a form GET, so a narrowed view is bookmarkable, shareable, crawlable, and
 * works with JavaScript off. Same law as `/records`.
 *
 * WHY THIS IS NOT IN `page.tsx`. Next 16 type-checks a route file's export surface against
 * a fixed allowlist (`default`, `metadata`, `revalidate`, and so on) and fails the build on
 * anything else, so a page cannot also be the module its tests import from.
 */
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';
import type { RailEntry } from '../../components/room';

/**
 * Sort keys. `series` is the default whenever a series is being viewed, because a
 * collection's own order (presidency number) is the order its reader expects; it falls
 * back to newest-first for anything with no series position.
 */
export const STORY_SORT_KEYS = ['series', 'newest', 'oldest', 'title'] as const;
export type StorySortKey = (typeof STORY_SORT_KEYS)[number];

export const STORY_KINDS = ['chapter', 'article'] as const;

export type StoriesQuery = {
  readonly q: string;
  readonly kind: string;
  readonly series: string;
  readonly tag: string;
  readonly era: string;
  readonly place: string;
  readonly sort: StorySortKey;
  readonly page: number;
};

const EMPTY_STORIES_QUERY: StoriesQuery = {
  q: '',
  kind: '',
  series: '',
  tag: '',
  era: '',
  place: '',
  sort: 'series',
  page: 1,
};

function isSortKey(value: string): value is StorySortKey {
  return (STORY_SORT_KEYS as readonly string[]).includes(value);
}

/**
 * Normalizes raw search params the same way `parseRecordsQuery` does: anything
 * unrecognised collapses to the default rather than throwing, because this route is
 * reachable from bookmarks, old links and crawlers.
 */
export function parseStoriesQuery(
  raw: Record<string, string | readonly string[] | undefined>,
): StoriesQuery {
  const one = (key: string): string => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' ? first.trim() : '';
  };
  const rawPage = Number.parseInt(one('page'), 10);
  const rawSort = one('sort');
  const rawKind = one('kind');
  return {
    q: one('q').slice(0, 120),
    kind: (STORY_KINDS as readonly string[]).includes(rawKind) ? rawKind : '',
    series: one('series'),
    tag: one('tag'),
    era: one('era'),
    place: one('place'),
    sort: isSortKey(rawSort) ? rawSort : 'series',
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1,
  };
}

/** Builds a `/stories` href. `page=1` and default sort are never emitted. */
export function storiesHref(query: Partial<StoriesQuery>): string {
  const merged = { ...EMPTY_STORIES_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.q.length > 0) params.set('q', merged.q);
  if (merged.kind.length > 0) params.set('kind', merged.kind);
  if (merged.series.length > 0) params.set('series', merged.series);
  if (merged.tag.length > 0) params.set('tag', merged.tag);
  if (merged.era.length > 0) params.set('era', merged.era);
  if (merged.place.length > 0) params.set('place', merged.place);
  if (merged.sort !== 'series') params.set('sort', merged.sort);
  if (merged.page > 1) params.set('page', String(merged.page));
  const search = params.toString();
  return search.length > 0 ? `/stories?${search}` : '/stories';
}

/**
 * Free-text match over the fields a reader can actually see on a card: title, summary,
 * series label and the entry's own position label ("16th president"). Deliberately a
 * substring scan rather than a ranked index — the collection is small enough that
 * exactness beats cleverness, and a reader typing "lincoln" wants the Lincoln entry, not
 * a relevance-ordered guess.
 */
function matchesText(item: PublicArticleListItemDoc, needle: string): boolean {
  if (needle.length === 0) return true;
  const haystack = [
    item.title,
    item.summary,
    item.eraLabel,
    item.placeLabel,
    item.series?.label ?? '',
    item.series?.positionLabel ?? '',
    ...(item.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export function filterItems(
  items: readonly PublicArticleListItemDoc[],
  query: StoriesQuery,
): readonly PublicArticleListItemDoc[] {
  return items.filter((item) => {
    if (query.kind.length > 0 && (item.kind ?? 'chapter') !== query.kind) return false;
    if (query.series.length > 0 && item.series?.id !== query.series) return false;
    if (query.tag.length > 0 && !(item.tags ?? []).includes(query.tag)) return false;
    if (query.era.length > 0 && item.eraLabel !== query.era) return false;
    if (query.place.length > 0 && item.placeLabel !== query.place) return false;
    if (!matchesText(item, query.q)) return false;
    return true;
  });
}

/**
 * Sorting is total and deterministic: every comparator falls through to slug, so two
 * entries that tie on the visible key never swap order between requests. A collection
 * whose order changes on refresh reads as broken even when the contents are right.
 */
export function sortItems(
  items: readonly PublicArticleListItemDoc[],
  sort: StorySortKey,
): readonly PublicArticleListItemDoc[] {
  const bySlug = (a: PublicArticleListItemDoc, b: PublicArticleListItemDoc) =>
    a.slug.localeCompare(b.slug);
  const copy = [...items];
  switch (sort) {
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title) || bySlug(a, b));
    case 'oldest':
      return copy.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || bySlug(a, b));
    case 'newest':
      return copy.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || bySlug(a, b));
    case 'series':
    default:
      // Series members sort by the collection's own key; everything else keeps
      // newest-first behind them, so a mixed index still leads with recent work.
      return copy.sort((a, b) => {
        const aPos = a.series?.position;
        const bPos = b.series?.position;
        if (aPos !== undefined && bPos !== undefined) return aPos - bPos || bySlug(a, b);
        if (aPos !== undefined) return -1;
        if (bPos !== undefined) return 1;
        return b.publishedAt.localeCompare(a.publishedAt) || bySlug(a, b);
      });
  }
}

type StoriesPage = {
  readonly rows: readonly PublicArticleListItemDoc[];
  readonly page: number;
  readonly pageCount: number;
  readonly previousHref: string | undefined;
  readonly nextHref: string | undefined;
};

/** Same page-size slice as `/records`: `RECORDS_PAGE_SIZE` rows per page, real anchors. */
export function paginateStories(
  matched: readonly PublicArticleListItemDoc[],
  query: StoriesQuery,
): StoriesPage {
  const pageCount = Math.max(1, Math.ceil(matched.length / RECORDS_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * RECORDS_PAGE_SIZE;
  const rows = matched.slice(start, start + RECORDS_PAGE_SIZE);
  return {
    rows,
    page,
    pageCount,
    previousHref: page > 1 ? storiesHref({ ...query, page: page - 1 }) : undefined,
    nextHref: page < pageCount ? storiesHref({ ...query, page: page + 1 }) : undefined,
  };
}

/** Published count, era span and place count for the header meta row. */
export function computeStoriesFacts(items: readonly PublicArticleListItemDoc[]): {
  readonly publishedCount: number;
  readonly eraSpanLabel: string | undefined;
  readonly placeCount: number;
} {
  const publishedCount = items.length;
  const years = items
    .map((item) => Number.parseInt(item.publishedAt.slice(0, 4), 10))
    .filter((year) => Number.isFinite(year));
  const eraSpanLabel =
    years.length === 0 ? undefined : `${Math.min(...years)} to ${Math.max(...years)}`;
  const placeCount = new Set(items.map((item) => item.placeLabel)).size;
  return { publishedCount, eraSpanLabel, placeCount };
}

function buildGroups(
  items: readonly PublicArticleListItemDoc[],
  label: (item: PublicArticleListItemDoc) => string,
  hrefFor: (label: string) => string,
): readonly RailEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = label(item);
    if (key.length === 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([entryLabel, count]) => ({ label: entryLabel, href: hrefFor(entryLabel), count }));
}

export function buildEraGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  return buildGroups(
    items,
    (item) => item.eraLabel,
    (era) => storiesHref({ era }),
  );
}

export function buildPlaceGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  return buildGroups(
    items,
    (item) => item.placeLabel,
    (place) => storiesHref({ place }),
  );
}

/** Collections, for the rail: one entry per distinct series, ordered by size. */
export function buildSeriesGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  const labels = new Map<string, string>();
  for (const item of items) {
    if (item.series) labels.set(item.series.id, item.series.label);
  }
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.series) continue;
    counts.set(item.series.id, (counts.get(item.series.id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({
      label: labels.get(id) ?? id,
      href: storiesHref({ series: id }),
      count,
    }));
}

export function buildTagGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ label: tag, href: storiesHref({ tag }), count }));
}

/** Kind chips, with live counts, so a reader can see both contracts exist. */
export function buildKindChips(
  items: readonly PublicArticleListItemDoc[],
  query: StoriesQuery,
): readonly {
  readonly label: string;
  readonly href: string;
  readonly count: number;
  readonly active: boolean;
}[] {
  const countOf = (kind: string) =>
    items.filter((item) => (item.kind ?? 'chapter') === kind).length;
  const base = { ...query, page: 1 };
  return [
    { label: 'All', href: storiesHref({ ...base, kind: '' }), count: items.length, active: query.kind === '' },
    {
      label: 'Chapters',
      href: storiesHref({ ...base, kind: 'chapter' }),
      count: countOf('chapter'),
      active: query.kind === 'chapter',
    },
    {
      label: 'Records',
      href: storiesHref({ ...base, kind: 'article' }),
      count: countOf('article'),
      active: query.kind === 'article',
    },
  ].filter((chip) => chip.count > 0 || chip.active);
}

export const STORY_SORT_LABELS: Record<StorySortKey, string> = {
  series: 'Collection order',
  newest: 'Newest first',
  oldest: 'Oldest first',
  title: 'Title A–Z',
};

/** True when any narrowing control is engaged — drives the "clear" affordance. */
export function hasActiveNarrowing(query: StoriesQuery): boolean {
  return (
    query.q.length > 0 ||
    query.kind.length > 0 ||
    query.series.length > 0 ||
    query.tag.length > 0 ||
    query.era.length > 0 ||
    query.place.length > 0
  );
}

type StoriesNotice = { readonly title: string; readonly body: string };

/**
 * The unavailable (load failure) state and the none-published state read differently on
 * purpose: one is a fault on our side and asks the reader to check back, the other is an
 * honest statement that the release has nothing here yet. Collapsing them into one message
 * would tell a reader whose connection to the live record failed that the archive is empty.
 */
export function storiesNotice(
  source: 'live' | 'unavailable',
  totalCount: number,
  filteredCount: number,
): StoriesNotice {
  if (source === 'unavailable') {
    return {
      title: 'Stories are temporarily unavailable',
      body: 'Stories are temporarily unavailable while we reconnect to the live record. Nothing here is lost; please check back shortly.',
    };
  }
  if (totalCount === 0) {
    return {
      title: 'No stories are published yet',
      body: 'No stories are published yet.',
    };
  }
  if (filteredCount === 0) {
    return {
      title: 'No stories match this narrowing',
      body: `Nothing in the release matches this narrowing. Clear it to see all ${totalCount.toLocaleString('en-US')} stories.`,
    };
  }
  return { title: '', body: '' };
}
