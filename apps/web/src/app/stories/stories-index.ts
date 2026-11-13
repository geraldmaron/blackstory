/**
 * The `/stories` index's pure logic: query parsing, href building, filtering, sorting,
 * windowing, the editorial front and the three notice states.
 *
 * A story is one long-form publication, and `format` says under which editorial contract:
 * `chapter` (era-immersion, prose floor) or `entry` (a short entry — a paragraph of
 * context plus individually cited call-outs). Both live in one index because a reader
 * looking for what the archive says about a subject should not have to know which
 * contract the answer was written under.
 *
 * Filtering, sorting and search are all URL state — no client-side store. Every control
 * is a link or a form GET, so a narrowed view is bookmarkable, shareable, crawlable, and
 * works with JavaScript off. Same law as `/records`.
 *
 * VOCABULARY. One word per thing, from the schema to the URL. A Story is any published piece;
 * its `format` is `chapter` or `entry`; an ordered set of entries (the presidency) is a
 * `collection` (schema field, query field, URL param, sort key all use the same word). "Chapter"
 * names one format; it does not mean "any story" — the citation edge that says which stories
 * reference a record is `storiesCiting`, not a chapter-only concept. The entry format's public
 * label is "Entry", not "Record": `/records` is the unrelated whole-archive entity index, and
 * reusing its name for a format chip sent a reader from one to the other thinking they were the
 * same kind of list.
 *
 * WHY THIS IS NOT IN `page.tsx`. Next 16 type-checks a route file's export surface against
 * a fixed allowlist (`default`, `metadata`, `revalidate`, and so on) and fails the build on
 * anything else, so a page cannot also be the module its tests import from.
 */
import type { PublicStoryListItemDoc } from '@repo/schemas';
import { RECORDS_PAGE_SIZE } from '../../lib/records/build-records-index';

/**
 * Sort keys. `collection` is the default whenever a collection is being viewed, because a
 * collection's own order (presidency number) is the order its reader expects; it falls
 * back to newest-first for anything with no collection position.
 */
export const STORY_SORT_KEYS = ['collection', 'newest', 'oldest', 'title'] as const;
export type StorySortKey = (typeof STORY_SORT_KEYS)[number];

export const STORY_FORMATS = ['chapter', 'entry'] as const;

export type StoriesQuery = {
  readonly q: string;
  readonly format: string;
  readonly collection: string;
  readonly tag: string;
  readonly era: string;
  readonly place: string;
  readonly sort: StorySortKey;
  readonly page: number;
};

const EMPTY_STORIES_QUERY: StoriesQuery = {
  q: '',
  // `''` is every published Story, and it is the unset state. The route is named `/stories`, so
  // bare `/stories` has to mean all of them: defaulting to `chapter` meant the index silently
  // hid every Entry unless a reader knew to append `format=all`, and the page's own doc comment
  // promised the opposite — that a reader should not have to know which editorial contract an
  // answer was written under.
  format: '',
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
  const rawFormat = one('format');
  // Absent, empty, `all`, or anything unrecognized all resolve to the full Story universe.
  // `format=all` stays accepted because it is a published URL, but it is no longer generated.
  const format = (STORY_FORMATS as readonly string[]).includes(rawFormat) ? rawFormat : '';
  return {
    q: one('q').slice(0, 120),
    format,
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
  // '' is the default — all Stories — and stays out of the URL like every other default below.
  // `format=all` is still parsed for the sake of published links, but never generated.
  if (merged.format.length > 0) params.set('format', merged.format);
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
function matchesText(item: PublicStoryListItemDoc, needle: string): boolean {
  if (needle.length === 0) return true;
  const haystack = [
    item.title,
    item.summary,
    item.eraLabel,
    item.placeLabel,
    item.collection?.label ?? '',
    item.collection?.positionLabel ?? '',
    ...(item.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export function filterItems(
  items: readonly PublicStoryListItemDoc[],
  query: StoriesQuery,
): readonly PublicStoryListItemDoc[] {
  return items.filter((item) => {
    if (query.format.length > 0 && (item.format ?? 'chapter') !== query.format) return false;
    if (query.collection.length > 0 && item.collection?.id !== query.collection) return false;
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
  items: readonly PublicStoryListItemDoc[],
  sort: StorySortKey,
): readonly PublicStoryListItemDoc[] {
  const bySlug = (a: PublicStoryListItemDoc, b: PublicStoryListItemDoc) =>
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
        const aPos = a.collection?.position;
        const bPos = b.collection?.position;
        if (aPos !== undefined && bPos !== undefined) return aPos - bPos || bySlug(a, b);
        if (aPos !== undefined) return -1;
        if (bPos !== undefined) return 1;
        return b.publishedAt.localeCompare(a.publishedAt) || bySlug(a, b);
      });
  }
}

type StoriesPage = {
  readonly rows: readonly PublicStoryListItemDoc[];
  readonly page: number;
  readonly pageCount: number;
  readonly previousHref: string | undefined;
  readonly nextHref: string | undefined;
};

/** Same page-size slice as `/records`: `RECORDS_PAGE_SIZE` rows per page, real anchors. */
export function paginateStories(
  matched: readonly PublicStoryListItemDoc[],
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

/**
 * The next entry in a collection after `afterPosition`, for the story page's "Next in this
 * collection" end block. `undefined` when the given collection has no later member (its own
 * `sortItems(..., 'collection')` order applies, so a tie on position falls back to slug like
 * everywhere else collection order is computed).
 */
export function nextInCollection(
  items: readonly PublicStoryListItemDoc[],
  collectionId: string,
  afterPosition: number,
): PublicStoryListItemDoc | undefined {
  const members = sortItems(
    items.filter((item) => item.collection?.id === collectionId),
    'collection',
  );
  return members.find((item) => (item.collection?.position ?? -1) > afterPosition);
}

/**
 * The member immediately before `beforePosition` in the same collection.
 *
 * The mirror of {@link nextInCollection}, and it reads the sorted list backwards rather than
 * filtering and taking the last: `sortItems(_, 'collection')` is the ordering a reader sees on
 * the index, so "previous" has to mean previous in THAT order, not the smallest position number.
 * A collection with a gap in its positions (the presidents collection leaves 24 vacant, because
 * Cleveland holds one entry for two terms) would otherwise skip.
 */
export function prevInCollection(
  items: readonly PublicStoryListItemDoc[],
  collectionId: string,
  beforePosition: number,
): PublicStoryListItemDoc | undefined {
  const members = sortItems(
    items.filter((item) => item.collection?.id === collectionId),
    'collection',
  );
  // Reverse scan rather than `findLast`, which this tsconfig's lib does not carry.
  for (let index = members.length - 1; index >= 0; index -= 1) {
    const item = members[index];
    if (item && (item.collection?.position ?? -1) < beforePosition) return item;
  }
  return undefined;
}

/**
 * The lead: the newest Chapter, falling back to the newest item of any format.
 *
 * Deterministic, and deliberately format-aware. Straight newest-first made the flagship of the
 * whole publication whichever short Entry happened to be published last. A Chapter is the deep
 * narrative form, so it leads when one exists.
 */
export function pickLeadStory(
  items: readonly PublicStoryListItemDoc[],
): PublicStoryListItemDoc | undefined {
  const newest = sortItems(items, 'newest');
  return newest.find((item) => (item.format ?? 'chapter') === 'chapter') ?? newest[0];
}

export type StoriesFront = {
  /** The full-width cover. */
  readonly lead: PublicStoryListItemDoc | undefined;
  /** The row of covers under it: the other Chapters, newest first, at most `maxCovers`. */
  readonly covers: readonly PublicStoryListItemDoc[];
  /** Everything else, in the order given: the ruled list. */
  readonly rest: readonly PublicStoryListItemDoc[];
};

/**
 * Splits the index into its editorial front and the list beneath it. Every item lands in exactly
 * one of the three parts, so no story is ever shown twice on the page.
 */
export function buildStoriesFront(
  items: readonly PublicStoryListItemDoc[],
  maxCovers = 3,
): StoriesFront {
  const lead = pickLeadStory(items);
  const covers = sortItems(
    items.filter((item) => item !== lead && (item.format ?? 'chapter') === 'chapter'),
    'newest',
  ).slice(0, maxCovers);
  const shown = new Set([lead, ...covers]);
  return { lead, covers, rest: items.filter((item) => !shown.has(item)) };
}

/** Kind chips, with live counts, so a reader can see both contracts exist. */
export function buildKindChips(
  items: readonly PublicStoryListItemDoc[],
  query: StoriesQuery,
): readonly {
  readonly label: string;
  readonly href: string;
  readonly count: number;
  readonly active: boolean;
}[] {
  const countOf = (format: string) =>
    items.filter((item) => (item.format ?? 'chapter') === format).length;
  const base = { ...query, page: 1 };
  return [
    {
      label: 'All',
      href: storiesHref({ ...base, format: '' }),
      count: items.length,
      active: query.format === '',
    },
    {
      label: 'Chapters',
      href: storiesHref({ ...base, format: 'chapter' }),
      count: countOf('chapter'),
      active: query.format === 'chapter',
    },
    {
      // Not "Records": `/records` is the unrelated whole-archive entity index, and reusing its
      // name here sent a reader clicking this chip expecting that list.
      label: 'Entries',
      href: storiesHref({ ...base, format: 'entry' }),
      count: countOf('entry'),
      active: query.format === 'entry',
    },
  ].filter((chip) => chip.count > 0 || chip.active);
}

export const STORY_SORT_LABELS: Record<StorySortKey, string> = {
  collection: 'Collection order',
  newest: 'Newest first',
  oldest: 'Oldest first',
  title: 'Title A–Z',
};

/** A search or a collection, tag, era or place narrowing: anything beyond format and sort. */
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
 * True only on bare `/stories`: every format, collection order, nothing narrowed. That is the one
 * state the editorial front (lead cover and chapter covers) renders in; any choice in the toolbar
 * turns the page into the flat list of what matches, so the covers never hide a match.
 */
export function showsFront(query: StoriesQuery): boolean {
  return query.format === '' && query.sort === 'collection' && !hasFieldNarrowing(query);
}

/** True when any narrowing control is engaged: drives the "Clear all" affordance. */
export function hasActiveNarrowing(query: StoriesQuery): boolean {
  return query.format !== '' || hasFieldNarrowing(query);
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
      body: 'The live record could not be reached, so the stories cannot be listed right now. Nothing is lost. Reload or check back shortly.',
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
      title: 'No stories match',
      body: `Nothing published matches these choices. Clear them to see all ${totalCount.toLocaleString('en-US')} stories.`,
    };
  }
  return { title: '', body: '' };
}
