/**
 * User-facing copy for the banned-books catalog and detail rooms.
 * Tests pin the strings that must stay checkable (census limit, affiliate, no statewide claim).
 */

export const BOOKS_PAGE_DESCRIPTION =
  'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources. Not a complete national census.';

/** The one line under the catalog: what a state means here, and the census limit. */
export const BOOKS_INDEX_NOTE =
  'A state here follows a cited report of a challenge that is still reported, banned or restricted. It is not a claim that the book left every school in that state, and this is not a complete national census.';

/** Where cover art comes from, printed once with the list's closing note. */
export const BOOKS_COVER_CREDIT =
  'Covers are publisher artwork, shown as published, from Open Library.';

export const BOOKS_DETAIL = {
  challengesLede:
    'Challenges still reported, banned, restricted or of unstated outcome. Rescinded and retained challenges are left out. A state here follows a cited report; it is not a claim that the book left every school in that state.',
  /** One meta line, printed directly under the Bookshop link it discloses. */
  affiliateNotice:
    'Affiliate link. BlackStory earns a commission, which never decides which titles appear.',
} as const;
