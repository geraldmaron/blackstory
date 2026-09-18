/**
 * User-facing copy for the banned-books catalog and detail rooms.
 * Tests pin the strings that must stay checkable (census limit, affiliate, no statewide claim).
 */

export const BOOKS_PAGE_DESCRIPTION =
  'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources. Not a complete national census.';

export const BOOKS_INDEX_LEDE =
  'Documented removal requests against titles in schools and libraries, cited from public reports. Not a list of controversial books, and not a complete national census.';

export const BOOKS_INTRO = {
  kicker: 'Reference',
  titleWarm: 'books',
  lede: 'Challenged and restricted titles tied to Black history and related reading. Each entry carries cited challenge reports and a path to buy or look up the book. Not a complete national census; status can change.',
} as const;

export const BOOKS_JUMP = [
  { id: 'read', label: 'How to read this', icon: 'books' as const },
  { id: 'browse', label: 'The catalog', icon: 'publication' as const },
  { id: 'related', label: 'Keep going', icon: 'rooms' as const },
] as const;

export const BOOKS_CATALOG = {
  kicker: 'Catalog',
  title: 'Challenged titles',
  lede: 'Search by title, author, or summary. Filter by state and author. Sort by title, author, year, citations, or challenge breadth.',
  emptyTitle: 'No titles matched',
  emptyBody: 'Try a broader keyword or reset the state and author filters.',
  emptyAction: 'Clear filters',
} as const;

export const BOOKS_ABOUT = {
  kicker: 'Limits',
  title: 'How to read this list',
  lede: 'A title is on this list while a cited challenge remains reported, unknown, banned, or restricted in that jurisdiction. Challenges that ended as rescinded or retained are not counted. State codes come from those reports. They are not a claim that a book was pulled from every school in the state.',
} as const;

export const BOOKS_READ_FACTS = [
  {
    title: 'Not a census',
    body: 'This is not every challenged title in the country, and status can change after the report an entry cites.',
    icon: 'errata' as const,
  },
  {
    title: 'Cited reports',
    body: 'Each entry names the public reports it rests on. The report is the authority; this page is the finding aid.',
    icon: 'evidence' as const,
  },
  {
    title: 'Bookshop links',
    body: 'Some titles link to Bookshop.org through an affiliate program. A purchase through one of those links pays BlackStory a commission. That relationship never decides which titles appear.',
    icon: 'books' as const,
  },
] as const;

export const BOOKS_RELATED = {
  kicker: 'Next',
  title: 'Keep going',
} as const;

export const BOOKS_DETAIL = {
  introKicker: 'Challenged book',
  contextKicker: 'Context',
  contextTitle: 'About this title',
  challengesKicker: 'Challenges',
  challengesTitle: 'States on challenge lists',
  challengesLede:
    'Validated USPS codes for challenges currently reported, unknown, banned, or restricted. Rescinded and retained entries are omitted. Codes follow cited public reports, not a claim of statewide removal.',
  evidenceKicker: 'Evidence',
  evidenceTitle: 'Citations',
  affiliateKicker: 'Affiliate',
  affiliateTitle: 'Buy on Bookshop',
  affiliateNotice:
    'This is a paid affiliate link. BlackStory earns a commission when you buy through it, and Bookshop.org also supports independent bookstores.',
  lookupKicker: 'Lookup',
  lookupTitle: 'Purchase and identifiers',
  lookupFootnote: 'Open Library is a free catalog reference, not a purchase path.',
  relatedKicker: 'Related',
  relatedTitle: 'More in this catalog',
  connectedKicker: 'Connected',
  connectedTitle: 'Keep going',
} as const;
