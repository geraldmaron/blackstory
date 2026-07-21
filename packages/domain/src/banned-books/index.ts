/**
 * Banned-books domain module public surface: types, validators, and purchase-link helpers.
 */
export {
  BANNED_BOOKS_SNAPSHOT_NAME,
  MIN_BANNED_BOOK_CITATIONS,
  MAX_BANNED_BOOK_PURCHASE_LINKS,
} from './types.js';
export type {
  BannedBookAuthor,
  BannedBookIdentifier,
  BannedBookCitation,
  BannedBookPurchaseLink,
  BannedBookChallengeStatus,
  BannedBookChallenge,
  BannedBookProvenance,
  BannedBookRecord,
  BannedBooksListingSnapshot,
} from './types.js';

export {
  isUspsStateCode,
  assertBannedBookRecord,
  validateBannedBookRecord,
  validateBannedBooksListing,
  bannedBookReportedStates,
} from './validate.js';
export type { BannedBookValidationResult } from './validate.js';

export {
  DEFAULT_BOOKSHOP_AFFILIATE_ID,
  buildIsbnPurchaseLinks,
  markPurchaseLinkValidation,
} from './purchase-links.js';
export type { BuildIsbnPurchaseLinksOptions } from './purchase-links.js';
