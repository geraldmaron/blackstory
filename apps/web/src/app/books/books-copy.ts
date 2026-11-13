/**
 * User-facing copy for the banned-books catalog and detail rooms.
 * Tests pin the strings that must stay checkable (census limit, affiliate, no statewide claim).
 */

export const BOOKS_PAGE_DESCRIPTION =
  'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources. Not a complete national census.';

/** The one line under the catalog: what a state means here, and the census limit. */
export const BOOKS_INDEX_NOTE =
  'A state here follows a cited report of a challenge that is still reported, banned or restricted. It is not a claim that the book left every school in that state, and this is not a complete national census.';

export const BOOKS_DETAIL = {
  challengesLede:
    'Challenges still reported, banned, restricted or of unstated outcome. Rescinded and retained challenges are left out. A state here follows a cited report; it is not a claim that the book left every school in that state.',
  /** One sentence, printed directly under the Bookshop link it discloses. */
  affiliateNotice:
    'BlackStory earns a commission on a purchase through this link, and that never decides which titles appear.',
} as const;
