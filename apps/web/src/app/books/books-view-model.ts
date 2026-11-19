/**
 * Pure view-model for the `/books` browse and detail pages. No Next.js runtime dependency.
 */
import {
  bannedBookReportedStates,
  type BannedBookRecord,
  type BannedBooksListingSnapshot,
} from '@repo/domain';
import { US_STATES } from '@repo/domain/map/geography';
import { coverIsbnForBook } from './books-cover';

export type BooksBrowseSortKey = 'title' | 'author' | 'year' | 'citations' | 'states';
export type BooksBrowseSortDir = 'asc' | 'desc';

export const BOOKS_BROWSE_SORT_KEYS = [
  'title',
  'author',
  'year',
  'citations',
  'states',
] as const satisfies readonly BooksBrowseSortKey[];

/** The cover wall, or the tile grid of states by challenge count. */
export type BooksView = 'covers' | 'states';

export type RawBooksBrowseParams = {
  readonly q?: string;
  readonly state?: string;
  readonly author?: string;
  readonly sort?: string;
  readonly dir?: string;
  readonly view?: string;
};

export type BooksBrowsePurchaseLink = {
  readonly retailer: string;
  readonly label: string;
  readonly href: string;
};

export type BooksBrowseItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authorNames: string;
  readonly publishedDate: string;
  /** Editorial summary from the curated record (`description`). */
  readonly summary: string;
  readonly states: readonly BooksDetailState[];
  readonly citationCount: number;
  readonly challengeCount: number;
  readonly coverIsbn: string | undefined;
  readonly purchaseLinks: readonly BooksBrowsePurchaseLink[];
};

/** One order the Sort menu offers. */
export type BooksSortPreset = {
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
  readonly label: string;
};

export const BOOKS_SORT_PRESETS: readonly BooksSortPreset[] = [
  { sort: 'title', dir: 'asc', label: 'Title, A to Z' },
  { sort: 'author', dir: 'asc', label: 'Author, A to Z' },
  { sort: 'year', dir: 'desc', label: 'Newest first' },
  { sort: 'states', dir: 'desc', label: 'Most states' },
  { sort: 'citations', dir: 'desc', label: 'Most sources' },
];

/** A state and how many titles carry a cited challenge there, within the other filters. */
export type BooksStateCount = {
  readonly code: string;
  readonly name: string;
  readonly count: number;
};

export type BooksBrowseViewModel = {
  readonly q: string;
  readonly state: string;
  readonly author: string;
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
  readonly view: BooksView;
  /** Every matching title, in order. The catalog is small enough to show whole. */
  readonly items: readonly BooksBrowseItem[];
  readonly totalMatched: number;
  readonly totalAvailable: number;
  /** States with at least one title, most titles first, counted within the search and author. */
  readonly stateCounts: readonly BooksStateCount[];
  /** Authors, by name, with their title counts across the catalog. */
  readonly authorCounts: readonly { readonly name: string; readonly count: number }[];
  /** The Sort menu's label for the current order. */
  readonly sortLabel: string;
};

export type BooksDetailState = {
  readonly code: string;
  readonly name: string;
};

export type BooksDetailViewModel =
  | { readonly kind: 'not_found' }
  | {
      readonly kind: 'ok';
      readonly book: BannedBookRecord;
      readonly states: readonly BooksDetailState[];
    };

const STATE_NAME_BY_CODE = new Map(US_STATES.map((state) => [state.postalCode, state.name]));

/** A postal code's state name, or the code itself for one the domain list does not hold. */
export function bookStateName(code: string): string {
  return STATE_NAME_BY_CODE.get(code) ?? code;
}

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

function formatAuthorNames(book: BannedBookRecord): string {
  return book.authors.map((author) => author.name).join(', ');
}

const ACTIVE_CHALLENGE_STATUSES = new Set(['reported', 'unknown', 'banned', 'restricted']);

/** Challenges that are currently in effect (reported, unknown, banned, or restricted). */
export function activeBookChallenges(book: BannedBookRecord): BannedBookRecord['challenges'] {
  return book.challenges.filter((challenge) => ACTIVE_CHALLENGE_STATUSES.has(challenge.status));
}

function activeChallengeCount(book: BannedBookRecord): number {
  return activeBookChallenges(book).length;
}

function recordToBrowseItem(book: BannedBookRecord): BooksBrowseItem {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    authorNames: formatAuthorNames(book),
    publishedDate: book.publishedDate,
    summary: book.description.trim(),
    states: bannedBookReportedStates(book).map((code) => ({
      code,
      name: STATE_NAME_BY_CODE.get(code) ?? code,
    })),
    citationCount: book.citations.length,
    challengeCount: activeChallengeCount(book),
    coverIsbn: coverIsbnForBook(book),
    purchaseLinks: book.purchaseLinks.map((link) => ({
      retailer: link.retailer,
      label: link.label,
      href: link.href,
    })),
  };
}

function parseSortKey(raw: string | undefined): BooksBrowseSortKey {
  const value = (raw ?? '').trim().toLowerCase();
  return (BOOKS_BROWSE_SORT_KEYS as readonly string[]).includes(value)
    ? (value as BooksBrowseSortKey)
    : 'title';
}

function parseSortDir(raw: string | undefined): BooksBrowseSortDir {
  return (raw ?? '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function compareBrowseItems(
  left: BooksBrowseItem,
  right: BooksBrowseItem,
  sort: BooksBrowseSortKey,
): number {
  switch (sort) {
    case 'author':
      return left.authorNames.localeCompare(right.authorNames, undefined, { sensitivity: 'base' });
    case 'year':
      return left.publishedDate.localeCompare(right.publishedDate);
    case 'citations':
      return left.citationCount - right.citationCount;
    case 'states':
      return left.states.length - right.states.length;
    case 'title':
    default:
      return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
  }
}

export function buildBooksBrowseHref(params: {
  readonly q: string;
  readonly state: string;
  readonly author: string;
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
  readonly view?: BooksView;
}): string {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set('q', params.q.trim());
  if (params.state !== 'all') search.set('state', params.state);
  if (params.author !== 'all') search.set('author', params.author);
  if (params.sort !== 'title') search.set('sort', params.sort);
  if (params.dir !== 'asc') search.set('dir', params.dir);
  if (params.view === 'states') search.set('view', 'states');
  const query = search.toString();
  return query ? `/books?${query}` : '/books';
}

const SORT_KEY_LABELS: Readonly<Record<BooksBrowseSortKey, string>> = {
  title: 'Title',
  author: 'Author',
  year: 'Year',
  citations: 'Sources',
  states: 'States',
};

/** The preset's label, or for an order only an old link carries, its key and direction. */
function sortLabelFor(sort: BooksBrowseSortKey, dir: BooksBrowseSortDir): string {
  const preset = BOOKS_SORT_PRESETS.find((entry) => entry.sort === sort && entry.dir === dir);
  return preset?.label ?? `${SORT_KEY_LABELS[sort]}, ${dir === 'asc' ? 'ascending' : 'descending'}`;
}

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function buildBooksBrowseViewModel(
  snapshot: BannedBooksListingSnapshot,
  raw: RawBooksBrowseParams,
): BooksBrowseViewModel {
  const q = (raw.q ?? '').trim().toLowerCase();
  // A state or author no title carries (a typo, an old link) is dropped, never echoed back.
  const rawState = cleanSelectParam(raw.state).toUpperCase();
  const state = snapshot.books.some((book) => bannedBookReportedStates(book).includes(rawState))
    ? rawState
    : 'all';
  const rawAuthor = cleanSelectParam(raw.author);
  const author = snapshot.books.some((book) => book.authors.some((a) => a.name === rawAuthor))
    ? rawAuthor
    : 'all';
  const sort = parseSortKey(raw.sort);
  const dir = parseSortDir(raw.dir);
  const view: BooksView = (raw.view ?? '').trim() === 'states' ? 'states' : 'covers';

  // Search and author narrow both views; the state filter narrows the wall. The state view counts
  // within search and author, so a state's number is what its link will show.
  const searched = snapshot.books.filter((book) => {
    if (author !== 'all' && !book.authors.some((entry) => entry.name === author)) return false;
    if (q) {
      const haystack = `${book.title} ${formatAuthorNames(book)} ${book.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const filtered =
    state === 'all'
      ? searched
      : searched.filter((book) => bannedBookReportedStates(book).includes(state));

  const items = filtered.map(recordToBrowseItem).sort((left, right) => {
    const primary = compareBrowseItems(left, right, sort);
    const ordered = dir === 'desc' ? -primary : primary;
    if (ordered !== 0) return ordered;
    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
  });

  const stateCounts = [...countBy(searched.flatMap((book) => bannedBookReportedStates(book)))]
    .map(([code, count]) => ({ code, name: STATE_NAME_BY_CODE.get(code) ?? code, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const authorCounts = [
    ...countBy(snapshot.books.flatMap((book) => book.authors.map((entry) => entry.name))),
  ]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    q: raw.q ?? '',
    state,
    author,
    sort,
    dir,
    view,
    items,
    totalMatched: items.length,
    totalAvailable: snapshot.books.length,
    stateCounts,
    authorCounts,
    sortLabel: sortLabelFor(sort, dir),
  };
}

export function buildBooksDetailViewModel(
  snapshot: BannedBooksListingSnapshot,
  slug: string,
): BooksDetailViewModel {
  const book = snapshot.books.find((entry) => entry.slug === slug);
  if (!book) return { kind: 'not_found' };

  const states = bannedBookReportedStates(book).map((code) => ({
    code,
    name: STATE_NAME_BY_CODE.get(code) ?? code,
  }));

  return {
    kind: 'ok',
    book,
    states,
  };
}

export function listBooksStaticParams(
  snapshot: BannedBooksListingSnapshot,
): readonly { readonly slug: string }[] {
  return snapshot.books.map((book) => ({ slug: book.slug }));
}

/**
 * Other titles by the same author: a typed relationship (shared authorship). Sharing a
 * challenge state is collection membership, not a connection, so it never qualifies.
 */
export function buildBooksRelatedItems(
  snapshot: BannedBooksListingSnapshot,
  book: BannedBookRecord,
  limit = 4,
): readonly BooksBrowseItem[] {
  const authorNames = new Set(book.authors.map((entry) => entry.name));
  return snapshot.books
    .filter(
      (entry) =>
        entry.slug !== book.slug && entry.authors.some((author) => authorNames.has(author.name)),
    )
    .sort((left, right) =>
      left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }),
    )
    .slice(0, limit)
    .map(recordToBrowseItem);
}
