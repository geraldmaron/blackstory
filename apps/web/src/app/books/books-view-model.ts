/**
 * Pure view-model for the `/books` browse and detail pages. No Next.js runtime dependency.
 */
import {
  bannedBookReportedStates,
  type BannedBookRecord,
  type BannedBooksListingSnapshot,
} from '@repo/domain';
import { US_STATES } from '@repo/domain/map/geography';

export type BooksBrowseSortKey = 'title' | 'author' | 'year' | 'citations' | 'states';
export type BooksBrowseSortDir = 'asc' | 'desc';

export const BOOKS_BROWSE_SORT_KEYS = [
  'title',
  'author',
  'year',
  'citations',
  'states',
] as const satisfies readonly BooksBrowseSortKey[];

/** Titles per browse page (card grid: 1 / 2 / 3 columns). */
export const BOOKS_BROWSE_PAGE_SIZE = 12;

export type RawBooksBrowseParams = {
  readonly q?: string;
  readonly state?: string;
  readonly author?: string;
  readonly sort?: string;
  readonly dir?: string;
  readonly page?: string;
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
  readonly purchaseLinks: readonly BooksBrowsePurchaseLink[];
};

export type BooksBrowseSortOption = {
  readonly key: BooksBrowseSortKey;
  readonly label: string;
  readonly active: boolean;
  readonly ariaSort: 'ascending' | 'descending' | 'none';
  readonly href: string;
};

export type BooksBrowsePagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly totalMatched: number;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly previousHref: string | undefined;
  readonly nextHref: string | undefined;
  readonly pageHrefs: readonly { readonly page: number; readonly href: string; readonly current: boolean }[];
};

export type BooksBrowseViewModel = {
  readonly q: string;
  readonly state: string;
  readonly author: string;
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
  readonly page: number;
  readonly items: readonly BooksBrowseItem[];
  readonly totalMatched: number;
  readonly stateOptions: readonly { readonly value: string; readonly label: string }[];
  readonly authorOptions: readonly { readonly value: string; readonly label: string }[];
  readonly sortOptions: readonly BooksBrowseSortOption[];
  readonly pagination: BooksBrowsePagination;
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

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

function formatAuthorNames(book: BannedBookRecord): string {
  return book.authors.map((author) => author.name).join(', ');
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
    purchaseLinks: book.purchaseLinks.map((link) => ({
      retailer: link.retailer,
      label: link.label,
      href: link.href,
    })),
  };
}

function buildFacetOptions(
  values: readonly string[],
  allLabel: string,
): readonly { value: string; label: string }[] {
  const unique = [...new Set(values)].sort((left, right) => left.localeCompare(right));
  return [{ value: 'all', label: allLabel }, ...unique.map((value) => ({ value, label: value }))];
}

function buildStateFacetOptions(
  books: readonly BannedBookRecord[],
): readonly { value: string; label: string }[] {
  const codes = new Set<string>();
  for (const book of books) {
    for (const code of bannedBookReportedStates(book)) {
      codes.add(code);
    }
  }
  const sorted = [...codes].sort((left, right) => left.localeCompare(right));
  return [
    { value: 'all', label: 'All states' },
    ...sorted.map((code) => ({
      value: code,
      label: `${STATE_NAME_BY_CODE.get(code) ?? code} (${code})`,
    })),
  ];
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

function parsePage(raw: string | undefined, totalPages: number): number {
  const parsed = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(parsed, totalPages);
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
  readonly page?: number;
}): string {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set('q', params.q.trim());
  if (params.state !== 'all') search.set('state', params.state);
  if (params.author !== 'all') search.set('author', params.author);
  if (params.sort !== 'title') search.set('sort', params.sort);
  if (params.dir !== 'asc') search.set('dir', params.dir);
  if (params.page !== undefined && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/books?${query}` : '/books';
}

function buildSortOptions(params: {
  readonly q: string;
  readonly state: string;
  readonly author: string;
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
}): readonly BooksBrowseSortOption[] {
  const labels: Record<BooksBrowseSortKey, string> = {
    title: 'Title',
    author: 'Author',
    year: 'Year',
    citations: 'Citations',
    states: 'States',
  };

  return BOOKS_BROWSE_SORT_KEYS.map((key) => {
    const active = params.sort === key;
    const nextDir: BooksBrowseSortDir = active && params.dir === 'asc' ? 'desc' : 'asc';
    return {
      key,
      label: labels[key],
      active,
      ariaSort: active ? (params.dir === 'asc' ? 'ascending' : 'descending') : 'none',
      href: buildBooksBrowseHref({
        q: params.q,
        state: params.state,
        author: params.author,
        sort: key,
        dir: active ? nextDir : 'asc',
        page: 1,
      }),
    };
  });
}

function buildPagination(params: {
  readonly q: string;
  readonly state: string;
  readonly author: string;
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
  readonly page: number;
  readonly pageSize: number;
  readonly totalMatched: number;
}): BooksBrowsePagination {
  const totalPages = Math.max(1, Math.ceil(params.totalMatched / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const rangeStart = params.totalMatched === 0 ? 0 : (page - 1) * params.pageSize + 1;
  const rangeEnd = Math.min(page * params.pageSize, params.totalMatched);

  const hrefFor = (target: number) =>
    buildBooksBrowseHref({
      q: params.q,
      state: params.state,
      author: params.author,
      sort: params.sort,
      dir: params.dir,
      page: target,
    });

  const pageHrefs = Array.from({ length: totalPages }, (_, index) => {
    const pageNumber = index + 1;
    return {
      page: pageNumber,
      href: hrefFor(pageNumber),
      current: pageNumber === page,
    };
  });

  return {
    page,
    pageSize: params.pageSize,
    totalPages,
    totalMatched: params.totalMatched,
    rangeStart,
    rangeEnd,
    previousHref: page > 1 ? hrefFor(page - 1) : undefined,
    nextHref: page < totalPages ? hrefFor(page + 1) : undefined,
    pageHrefs,
  };
}

export function buildBooksBrowseViewModel(
  snapshot: BannedBooksListingSnapshot,
  raw: RawBooksBrowseParams,
): BooksBrowseViewModel {
  const q = (raw.q ?? '').trim().toLowerCase();
  const state = cleanSelectParam(raw.state);
  const author = cleanSelectParam(raw.author);
  const sort = parseSortKey(raw.sort);
  const dir = parseSortDir(raw.dir);
  const qRaw = raw.q ?? '';

  const filtered = snapshot.books.filter((book) => {
    if (state !== 'all' && !bannedBookReportedStates(book).includes(state)) {
      return false;
    }

    if (author !== 'all') {
      const names = book.authors.map((entry) => entry.name);
      if (!names.includes(author)) return false;
    }

    if (q) {
      const haystack = `${book.title} ${formatAuthorNames(book)} ${book.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const sorted = filtered.map(recordToBrowseItem).sort((left, right) => {
    const primary = compareBrowseItems(left, right, sort);
    const ordered = dir === 'desc' ? -primary : primary;
    if (ordered !== 0) return ordered;
    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
  });

  const totalMatched = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalMatched / BOOKS_BROWSE_PAGE_SIZE));
  const page = parsePage(raw.page, totalPages);
  const start = (page - 1) * BOOKS_BROWSE_PAGE_SIZE;
  const items = sorted.slice(start, start + BOOKS_BROWSE_PAGE_SIZE);

  const authorNames = snapshot.books.flatMap((book) => book.authors.map((entry) => entry.name));

  return {
    q: qRaw,
    state,
    author,
    sort,
    dir,
    page,
    items,
    totalMatched,
    stateOptions: buildStateFacetOptions(snapshot.books),
    authorOptions: buildFacetOptions(authorNames, 'All authors'),
    sortOptions: buildSortOptions({
      q: qRaw,
      state,
      author,
      sort,
      dir,
    }),
    pagination: buildPagination({
      q: qRaw,
      state,
      author,
      sort,
      dir,
      page,
      pageSize: BOOKS_BROWSE_PAGE_SIZE,
      totalMatched,
    }),
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

export function stateLabel(code: string): string {
  const name = STATE_NAME_BY_CODE.get(code);
  return name ? `${name} (${code})` : code;
}
