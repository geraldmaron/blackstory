/**
 * The `/stories` index's pure logic: query parsing, href building, filtering, sorting,
 * windowing, header facts, the rail groups and the three notice states.
 *
 * A story is one long-form publication, and `kind` says under which editorial contract:
 * `chapter` (era-immersion, prose floor) or `article` (a short entry — a paragraph of
 * context plus individually cited call-outs). Both live in one index because a reader
 * looking for what the archive says about a subject should not have to know which
 * contract the answer was written under.
 *
 * Filtering, sorting and search are all URL state — no client-side store. Every control
 * is a link or a form GET, so a narrowed view is bookmarkable, shareable, crawlable, and
 * works with JavaScript off. Same law as `/records`.
 *
 * VOCABULARY. `collection` (query field, URL param, sort key) is the reader-facing word for
 * what the schema calls a `series` — an ordered set like the presidency (`item.series` stays
 * the schema's own field name; only the navigation-facing vocabulary changed). "Chapter" names
 * one editorial contract; it does not mean "any story" — the citation edge that says which
 * stories reference a record is `storiesCiting`, not a chapter-only concept. And the `article`
 * kind's public label is "Entry", not "Record": `/records` is the unrelated whole-archive entity
 * index, and reusing its name for a Stories kind chip sent a reader from one to the other
 * thinking they were the same kind of list.
 *
 * WHY THIS IS NOT IN `page.tsx`. Next 16 type-checks a route file's export surface against
 * a fixed allowlist (`default`, `metadata`, `revalidate`, and so on) and fails the build on
 * anything else, so a page cannot also be the module its tests import from.
 */
import type { PublicArticleListItemDoc } from '@repo/schemas';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';
import type { RailEntry } from '../../components/room';

/**
 * Sort keys. `collection` is the default whenever a collection is being viewed, because a
 * collection's own order (presidency number) is the order its reader expects; it falls
 * back to newest-first for anything with no collection position.
 */
export const STORY_SORT_KEYS = ['collection', 'newest', 'oldest', 'title'] as const;
export type StorySortKey = (typeof STORY_SORT_KEYS)[number];

export const STORY_KINDS = ['chapter', 'article'] as const;

export type StoriesQuery = {
  readonly q: string;
  readonly kind: string;
  readonly collection: string;
  readonly tag: string;
  readonly era: string;
  readonly place: string;
  readonly sort: StorySortKey;
  readonly page: number;
};

const EMPTY_STORIES_QUERY: StoriesQuery = {
  q: '',
  // Chapters are the default view; `kind: ''` is reserved for an explicit "All" narrowing
  // (URL param `kind=all`), not the unset state.
  kind: 'chapter',
  collection: '',
  tag: '',
  era: '',
  place: '',
  sort: 'collection',
  page: 1,
};

function isSortKey(value: string): value is StorySortKey {
  return (STORY_SORT_KEYS as readonly string[]).includes(value);
}

/**
 * Normalizes raw search params the same way `parseRecordsQuery` does: anything
 * unrecognized collapses to the default rather than throwing, because this route is
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
  // `kind=all` is the only way to reach the unfiltered view; anything unrecognized
  // (including no param at all) falls back to the chapters default rather than "all".
  const kind =
    rawKind === 'all'
      ? ''
      : (STORY_KINDS as readonly string[]).includes(rawKind)
        ? rawKind
        : 'chapter';
  return {
    q: one('q').slice(0, 120),
    kind,
    collection: one('collection'),
    tag: one('tag'),
    era: one('era'),
    place: one('place'),
    sort: isSortKey(rawSort) ? rawSort : 'collection',
    page: Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1,
  };
}

/** Builds a `/stories` href. `page=1` and default sort are never emitted. */
export function storiesHref(query: Partial<StoriesQuery>): string {
  const merged = { ...EMPTY_STORIES_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.q.length > 0) params.set('q', merged.q);
  // '' is the explicit "All" narrowing and must round-trip as `kind=all`; `chapter` is the
  // default and stays out of the URL like the other default values below.
  if (merged.kind === '') params.set('kind', 'all');
  else if (merged.kind !== 'chapter') params.set('kind', merged.kind);
  if (merged.collection.length > 0) params.set('collection', merged.collection);
  if (merged.tag.length > 0) params.set('tag', merged.tag);
  if (merged.era.length > 0) params.set('era', merged.era);
  if (merged.place.length > 0) params.set('place', merged.place);
  if (merged.sort !== 'collection') params.set('sort', merged.sort);
  if (merged.page > 1) params.set('page', String(merged.page));
  const search = params.toString();
  return search.length > 0 ? `/stories?${search}` : '/stories';
}

/**
 * Free-text match over the fields a reader can actually see on a card: title, summary,
 * collection label and the entry's own position label ("16th president"). Deliberately a
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
    if (query.collection.length > 0 && item.series?.id !== query.collection) return false;
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
    case 'collection':
    default:
      // Collection members sort by the collection's own key; everything else keeps
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

// Rail links (era/place/collection/tag) group across both editorial kinds — a collection like
// "The presidency" is entirely `article`, so these must carry an explicit kind: '' (renders as
// `kind=all`) rather than falling through to the chapters default, or they'd resolve to an
// empty result for any all-entry grouping.

export function buildEraGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  return buildGroups(
    items,
    (item) => item.eraLabel,
    (era) => storiesHref({ era, kind: '' }),
  );
}

export function buildPlaceGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  return buildGroups(
    items,
    (item) => item.placeLabel,
    (place) => storiesHref({ place, kind: '' }),
  );
}

/** Collections, for the rail: one entry per distinct collection, ordered by size. */
export function buildCollectionGroups(
  items: readonly PublicArticleListItemDoc[],
): readonly RailEntry[] {
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
      href: storiesHref({ collection: id, kind: '' }),
      count,
    }));
}

export type StoriesShelf = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
  readonly members: readonly PublicArticleListItemDoc[];
};

/**
 * One shelf per collection, ordered by size (largest first, same order as
 * `buildCollectionGroups`), each carrying its own first `membersPerShelf` entries in the
 * collection's own order. Reuses `sortItems(..., 'collection')` for member order rather than
 * inventing a second sort.
 */
export function buildCollectionShelves(
  items: readonly PublicArticleListItemDoc[],
  membersPerShelf = 4,
): readonly StoriesShelf[] {
  const labels = new Map<string, string>();
  const byCollection = new Map<string, PublicArticleListItemDoc[]>();
  for (const item of items) {
    if (!item.series) continue;
    labels.set(item.series.id, item.series.label);
    const list = byCollection.get(item.series.id);
    if (list) list.push(item);
    else byCollection.set(item.series.id, [item]);
  }
  return [...byCollection.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([id, members]) => ({
      id,
      label: labels.get(id) ?? id,
      count: members.length,
      href: storiesHref({ collection: id, kind: '' }),
      members: sortItems(members, 'collection').slice(0, membersPerShelf),
    }));
}

/**
 * The next entry in a collection after `afterPosition`, for the story page's "Next in this
 * collection" rail block. `undefined` when the given collection has no later member (its own
 * `sortItems(..., 'collection')` order applies, so a tie on position falls back to slug like
 * everywhere else collection order is computed).
 */
export function nextInCollection(
  items: readonly PublicArticleListItemDoc[],
  collectionId: string,
  afterPosition: number,
): PublicArticleListItemDoc | undefined {
  const members = sortItems(
    items.filter((item) => item.series?.id === collectionId),
    'collection',
  );
  return members.find((item) => (item.series?.position ?? -1) > afterPosition);
}

/** Stories with no collection — the "Everything else" list beneath the shelves. */
export function uncollectedItems(
  items: readonly PublicArticleListItemDoc[],
): readonly PublicArticleListItemDoc[] {
  return items.filter((item) => !item.series);
}

/**
 * The one story that leads the shelves page at full width: the most recently published
 * story in view. Deterministic and reads from data already on hand — no new field, no
 * editorial "featured" flag to maintain.
 */
export function pickLeadStory(
  items: readonly PublicArticleListItemDoc[],
): PublicArticleListItemDoc | undefined {
  return sortItems(items, 'newest')[0];
}

export function buildTagGroups(items: readonly PublicArticleListItemDoc[]): readonly RailEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ label: tag, href: storiesHref({ tag, kind: '' }), count }));
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
    {
      label: 'All',
      href: storiesHref({ ...base, kind: '' }),
      count: items.length,
      active: query.kind === '',
    },
    {
      label: 'Chapters',
      href: storiesHref({ ...base, kind: 'chapter' }),
      count: countOf('chapter'),
      active: query.kind === 'chapter',
    },
    {
      // Not "Records": `/records` is the unrelated whole-archive entity index, and reusing its
      // name here sent a reader clicking this chip expecting that list.
      label: 'Entries',
      href: storiesHref({ ...base, kind: 'article' }),
      count: countOf('article'),
      active: query.kind === 'article',
    },
  ].filter((chip) => chip.count > 0 || chip.active);
}

export const STORY_SORT_LABELS: Record<StorySortKey, string> = {
  collection: 'Collection order',
  newest: 'Newest first',
  oldest: 'Oldest first',
  title: 'Title A–Z',
};

/**
 * True whenever a search, a collection/tag/era/place narrowing, or a non-default sort is
 * engaged — the field-level narrowing that makes shelf browsing dishonest about what changed
 * (shelves have their own count order and per-collection position order). Deliberately excludes
 * the kind chip: a collection like the presidents is entirely `article`, so gating shelf mode on
 * `kind === 'chapter'` (the old behavior) meant its shelf could never render at all — the
 * default view filtered every one of its members out before the shelf builder ever saw them, and
 * clicking the "Entries" chip to actually find them dropped into the flat grid instead, since any
 * kind other than the default counted as "narrowed". A reader could see "The presidents on the
 * record (45)" advertised in the rail and never once reach a browsable shelf for it.
 */
function hasFieldNarrowing(query: StoriesQuery): boolean {
  return (
    query.q.length > 0 ||
    query.collection.length > 0 ||
    query.tag.length > 0 ||
    query.era.length > 0 ||
    query.place.length > 0
  );
}

/**
 * True in the page's unnarrowed browse state for whichever kind is in view — the state the
 * shelves layout renders in. `filtered` (built from the same query) is already scoped to the
 * active kind chip, so shelves, the lead and "Everything else" all inherit that scoping for
 * free; this only has to say whether shelf mode applies at all.
 */
export function showsShelves(query: StoriesQuery): boolean {
  return !hasFieldNarrowing(query) && query.sort === 'collection';
}

/** True when any narrowing control is engaged — drives the "clear" affordance. */
export function hasActiveNarrowing(query: StoriesQuery): boolean {
  // 'chapter' is the default view, not a narrowing; 'article' and '' (all) both are. This is
  // broader than `hasFieldNarrowing` on purpose: the Clear affordance resets the kind chip too,
  // even though the kind chip no longer gates shelf mode above.
  return query.kind !== 'chapter' || hasFieldNarrowing(query);
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
