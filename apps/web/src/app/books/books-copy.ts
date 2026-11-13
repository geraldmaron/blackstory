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
  },
  {
    title: 'Cited reports',
    body: 'Each entry names the public reports it rests on. The report is the authority; this page is the finding aid.',
  },
  {
    title: 'Bookshop links',
    body: 'Some titles link to Bookshop.org through an affiliate program. A purchase through one of those links pays BlackStory a commission. That relationship never decides which titles appear.',
  },
] as const;

export const BOOKS_DETAIL = {
  challengesLede:
    'Challenges still reported, banned, restricted or of unstated outcome. Rescinded and retained challenges are left out. A state here follows a cited report; it is not a claim that the book left every school in that state.',
  /** One sentence, printed directly under the Bookshop link it discloses. */
  affiliateNotice:
    'BlackStory earns a commission on a purchase through this link, and that never decides which titles appear.',
} as const;
