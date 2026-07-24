/**
 * Banned-books catalog loader and browse helpers for native mobile.
 * Reads the on-device seed snapshot exported from the web curated catalog.
 */
import catalogSeed from './catalog-seed.json';
import type {
  BannedBookRecord,
  BannedBooksListingSnapshot,
  BooksCatalogRow,
} from './types';

const USPS_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

/** Replace em/en dashes in display strings (brand: no em dashes in UI copy). */
export function plainDashCopy(value: string): string {
  return value.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' to ').replace(/\s{2,}/g, ' ').trim();
}

function isBookRecord(value: unknown): value is BannedBookRecord {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.slug === 'string' &&
    typeof row.title === 'string' &&
    Array.isArray(row.authors) &&
    Array.isArray(row.challenges) &&
    Array.isArray(row.citations)
  );
}

function isSnapshot(value: unknown): value is BannedBooksListingSnapshot {
  if (value === null || typeof value !== 'object') return false;
  const snap = value as Record<string, unknown>;
  return typeof snap.version === 'string' && Array.isArray(snap.books);
}

/** Sorted unique USPS codes from reported/unknown challenges. */
export function reportedStateCodes(book: BannedBookRecord): readonly string[] {
  const states = new Set<string>();
  for (const challenge of book.challenges) {
    if (challenge.status !== 'reported' && challenge.status !== 'unknown') continue;
    const code = challenge.state.toUpperCase();
    if (!USPS_STATE_CODES.has(code)) continue;
    states.add(code);
  }
  return [...states].sort((a, b) => a.localeCompare(b));
}

export function authorNames(book: BannedBookRecord): string {
  return book.authors.map((author) => author.name).join(', ');
}

export function toCatalogRow(book: BannedBookRecord): BooksCatalogRow {
  const states = reportedStateCodes(book);
  const challenges = book.challenges.filter(
    (c) => c.status === 'reported' || c.status === 'unknown',
  );
  return {
    id: book.id,
    slug: book.slug,
    title: plainDashCopy(book.title),
    authorNames: plainDashCopy(authorNames(book)),
    publishedDate: book.publishedDate,
    summary: plainDashCopy(book.description),
    statesLabel: states.length > 0 ? states.join(' · ') : 'No state codes listed',
    stateCodes: states,
    citationCount: book.citations.length,
    challengeCount: challenges.length,
    ...(book.canonicalEntityId ? { canonicalEntityId: book.canonicalEntityId } : {}),
  };
}

/** Loads the embedded catalog snapshot; returns empty books if seed is malformed. */
export function loadBooksCatalog(): BannedBooksListingSnapshot {
  if (!isSnapshot(catalogSeed)) {
    return {
      version: 'unavailable',
      generatedAt: new Date(0).toISOString(),
      source: 'unavailable',
      releaseLabel: 'Unavailable',
      books: [],
    };
  }
  const books = (catalogSeed.books as readonly unknown[]).filter(isBookRecord);
  const seed = catalogSeed as BannedBooksListingSnapshot & Record<string, unknown>;
  const source =
    seed.source === 'live-snapshot' || seed.source === 'curated-seed'
      ? seed.source
      : 'curated-seed';
  const releaseLabel =
    typeof seed.releaseLabel === 'string' && seed.releaseLabel.trim().length > 0
      ? seed.releaseLabel
      : 'Curated on-device seed';
  return {
    version: catalogSeed.version,
    generatedAt: catalogSeed.generatedAt,
    source,
    releaseLabel,
    books,
  };
}

export function getBookBySlug(slug: string): BannedBookRecord | undefined {
  const normalized = slug.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return loadBooksCatalog().books.find((book) => book.slug.toLowerCase() === normalized);
}

export function listCatalogRows(): readonly BooksCatalogRow[] {
  return loadBooksCatalog().books.map(toCatalogRow);
}

/**
 * Case-insensitive filter over title, authors, summary, and state codes.
 * Empty query returns the full catalog (title-sorted).
 */
export function filterCatalogRows(
  rows: readonly BooksCatalogRow[],
  query: string,
): readonly BooksCatalogRow[] {
  const q = query.trim().toLowerCase();
  const sorted = [...rows].sort((a, b) => a.title.localeCompare(b.title));
  if (q.length === 0) return sorted;
  return sorted.filter((row) => {
    const haystack = [
      row.title,
      row.authorNames,
      row.summary,
      row.statesLabel,
      row.publishedDate,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Catalog pulse counts for the browse mast. */
export function catalogPulse(snapshot: BannedBooksListingSnapshot = loadBooksCatalog()): {
  readonly titleCount: number;
  readonly authorCount: number;
  readonly stateCount: number;
  readonly version: string;
  readonly generatedAt: string;
  readonly source: BannedBooksListingSnapshot['source'];
  readonly releaseLabel: string;
} {
  const authors = new Set<string>();
  const states = new Set<string>();
  for (const book of snapshot.books) {
    for (const author of book.authors) {
      authors.add(author.name.toLowerCase());
    }
    for (const code of reportedStateCodes(book)) {
      states.add(code);
    }
  }
  return {
    titleCount: snapshot.books.length,
    authorCount: authors.size,
    stateCount: states.size,
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    releaseLabel: snapshot.releaseLabel,
  };
}

/** Same-author related rows excluding the current slug (max 6). */
export function relatedCatalogRows(slug: string, limit = 6): readonly BooksCatalogRow[] {
  const current = getBookBySlug(slug);
  if (!current) return [];
  const authorSet = new Set(current.authors.map((a) => a.name.toLowerCase()));
  return listCatalogRows()
    .filter((row) => {
      if (row.slug === current.slug) return false;
      const book = getBookBySlug(row.slug);
      if (!book) return false;
      return book.authors.some((a) => authorSet.has(a.name.toLowerCase()));
    })
    .slice(0, limit);
}

/** Defensive slug parse for route params (kebab-case, bounded). */
export function parseBookSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 160) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) return null;
  return trimmed;
}
