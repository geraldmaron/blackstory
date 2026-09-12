/**
 * User-facing copy for native Banned books. No em dashes.
 */
export const BOOKS_PAGE_DESCRIPTION =
  'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources. Not a complete national census.';

export const BOOKS_INTRO = {
  kicker: 'Reference',
  title: 'Banned books',
  lede: 'Challenged and restricted titles tied to Black history and related reading. Each entry carries cited challenge reports and a path to look up the book. Not a complete national census; status can change.',
} as const;

export const BOOKS_CATALOG = {
  kicker: 'Catalog',
  title: 'Challenged titles',
  lede: 'Search by title, author, or summary. Tap a row for challenges, citations, and purchase links.',
  searchPlaceholder: 'Search titles or authors…',
  emptyTitle: 'No titles matched',
  emptyBody: 'Try a broader keyword.',
  emptyAction: 'Clear search',
  seedNote:
    'Curated on-device seed (exported from the web listing). Not a live warehouse refresh. A mobile bannedBooksListing API is tracked separately.',
  sourceCurated: 'Curated seed',
  sourceLive: 'Live snapshot',
} as const;

export const BOOKS_ABOUT = {
  kicker: 'About',
  title: 'How to read this list',
  lede: 'Entries document reported school and library restrictions with public citations. State codes follow cited public reports, not a claim of statewide removal. Bookshop.org links use BlackStory affiliate referral to support independent bookstores.',
} as const;

export const BOOKS_DETAIL = {
  introKicker: 'Challenged book',
  contextTitle: 'About this title',
  challengesTitle: 'States on challenge lists',
  challengesLede:
    'Validated USPS codes for reported or unknown challenges. Rescinded entries are omitted. Codes follow cited public reports, not a claim of statewide removal.',
  evidenceTitle: 'Citations',
  lookupTitle: 'Purchase and identifiers',
  lookupFootnote:
    'Bookshop.org links support independent bookstores via BlackStory affiliate referral. Open Library is a free catalog reference, not a purchase path.',
  relatedTitle: 'More in this catalog',
  entityCta: 'Open linked place record',
  missingTitle: 'Book not found',
  missingBody:
    'That catalog entry is not in this release. Return to Banned books and pick another title.',
} as const;

/**
 * Reader-facing names for identifier systems.
 *
 * `identifier.system` is a connector key. Printing it raw put `isbn-13` and `open-library` on the
 * detail screen as if they were English, the same class of leak as the `wikipedia_api` citation
 * token the record page used to show. `humanizeToken` cannot help here: it would title-case these
 * into "Isbn 13", so the acronyms need naming outright. The list is a closed enum of six.
 */
export const BOOK_IDENTIFIER_SYSTEM_LABELS: Readonly<Record<string, string>> = {
  'isbn-13': 'ISBN-13',
  'isbn-10': 'ISBN-10',
  asin: 'ASIN',
  oclc: 'OCLC',
  'open-library': 'Open Library',
  other: 'Catalog id',
} as const;

export function bookIdentifierSystemLabel(system: string): string {
  return BOOK_IDENTIFIER_SYSTEM_LABELS[system] ?? BOOK_IDENTIFIER_SYSTEM_LABELS.other!;
}
