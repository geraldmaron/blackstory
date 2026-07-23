/**
 * User-facing copy constants for the Books v6 edition routes. Centralizes strings
 * for tests (em-dash guard) and keeps page/section JSX readable.
 */

export const BOOKS_PAGE_DESCRIPTION =
  'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources. Not a complete national census.';

export const BOOKS_INTRO = {
  kicker: 'Reference',
  titleWarm: 'books',
  lede:
    'Challenged and restricted titles tied to Black history and related reading. Each entry carries cited challenge reports and a path to buy or look up the book. Not a complete national census; status can change.',
} as const;

export const BOOKS_CATALOG = {
  kicker: 'Catalog',
  title: 'Challenged titles',
  lede:
    'Search by title, author, or summary. Filter by state and author. Sort by title, author, year, citations, or challenge breadth.',
  emptyTitle: 'No titles matched',
  emptyBody: 'Try a broader keyword or reset the state and author filters.',
  emptyAction: 'Clear filters',
} as const;

export const BOOKS_ABOUT = {
  kicker: 'About',
  title: 'How to read this list',
  lede:
    'Entries document reported school and library restrictions with public citations. State codes are validated USPS abbreviations from those reports, not a claim of statewide removal. Bookshop.org links use BlackStory affiliate referral to support independent bookstores.',
} as const;

export const BOOKS_DETAIL = {
  introKicker: 'Challenged book',
  contextKicker: 'Context',
  contextTitle: 'About this title',
  challengesKicker: 'Challenges',
  challengesTitle: 'States on challenge lists',
  challengesLede:
    'Validated USPS codes for reported or unknown challenges. Rescinded entries are omitted. Codes follow cited public reports, not a claim of statewide removal.',
  evidenceKicker: 'Evidence',
  evidenceTitle: 'Citations',
  lookupKicker: 'Lookup',
  lookupTitle: 'Purchase and identifiers',
  lookupFootnote:
    'Bookshop.org links support independent bookstores via BlackStory affiliate referral. Open Library is a free catalog reference, not a purchase path.',
  relatedKicker: 'Related',
  relatedTitle: 'More in this catalog',
  connectedKicker: 'Connected',
  connectedTitle: 'Keep going',
} as const;
