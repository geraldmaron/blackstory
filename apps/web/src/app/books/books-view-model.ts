/**
 * Pure view-model for the `/books` browse and detail pages. No Next.js runtime dependency.
 */
import {
  bannedBookReportedStates,
  type BannedBookRecord,
  type BannedBooksListingSnapshot,
} from '@repo/domain';
import { US_STATES } from '@repo/domain/map/geography';

export type RawBooksBrowseParams = {
  readonly q?: string;
  readonly state?: string;
  readonly author?: string;
};

export type BooksBrowseItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authorNames: string;
  readonly publishedDate: string;
  readonly states: readonly BooksDetailState[];
  readonly citationCount: number;
  readonly purchaseLinkCount: number;
};

export type BooksBrowseViewModel = {
  readonly q: string;
  readonly state: string;
  readonly author: string;
  readonly items: readonly BooksBrowseItem[];
  readonly totalMatched: number;
  readonly stateOptions: readonly { readonly value: string; readonly label: string }[];
  readonly authorOptions: readonly { readonly value: string; readonly label: string }[];
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
    states: bannedBookReportedStates(book).map((code) => ({
      code,
      name: STATE_NAME_BY_CODE.get(code) ?? code,
    })),
    citationCount: book.citations.length,
    purchaseLinkCount: book.purchaseLinks.length,
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

export function buildBooksBrowseViewModel(
  snapshot: BannedBooksListingSnapshot,
  raw: RawBooksBrowseParams,
): BooksBrowseViewModel {
  const q = (raw.q ?? '').trim().toLowerCase();
  const state = cleanSelectParam(raw.state);
  const author = cleanSelectParam(raw.author);

  const filtered = snapshot.books.filter((book) => {
    if (state !== 'all' && !bannedBookReportedStates(book).includes(state)) {
      return false;
    }

    if (author !== 'all') {
      const names = book.authors.map((entry) => entry.name);
      if (!names.includes(author)) return false;
    }

    if (q) {
      const haystack = `${book.title} ${formatAuthorNames(book)}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const authorNames = snapshot.books.flatMap((book) => book.authors.map((entry) => entry.name));

  return {
    q: raw.q ?? '',
    state,
    author,
    items: filtered.map(recordToBrowseItem),
    totalMatched: filtered.length,
    stateOptions: buildStateFacetOptions(snapshot.books),
    authorOptions: buildFacetOptions(authorNames, 'All authors'),
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
