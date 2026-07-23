/**
 * Banned-books listing vocabulary: author/identifier/citation shapes, challenge records,
 * purchase links, provenance, and the snapshot envelope for curated challenged-title corpora.
 */

/** Contributor credited on a challenged title listing. */
export type BannedBookAuthor = {
  readonly name: string;
  readonly role?: 'author' | 'editor' | 'illustrator' | 'contributor';
};

/** External catalog identifier for dedupe and purchase-link construction. */
export type BannedBookIdentifier = {
  readonly system: 'isbn-13' | 'isbn-10' | 'asin' | 'oclc' | 'open-library' | 'other';
  readonly value: string;
};

/** Evidence citation backing a challenge or listing fact; `href` must be a reachable URL. */
export type BannedBookCitation = {
  readonly label: string;
  readonly href: string;
  readonly publisher?: string;
  readonly publishedAt?: string;
};

/** Retailer or publisher link offered as a neutral acquisition path (max three per record). */
export type BannedBookPurchaseLink = {
  readonly retailer: 'bookshop' | 'amazon' | 'barnes-noble' | 'open-library' | 'publisher' | 'other';
  readonly label: string;
  readonly href: string;
  readonly validatedAt?: string;
  readonly validationStatus?: 'valid' | 'invalid' | 'unchecked';
};

/** Whether a reported challenge is still active, withdrawn, or undetermined. */
export type BannedBookChallengeStatus = 'reported' | 'rescinded' | 'unknown';

/** A jurisdiction-specific challenge event tied to one evidence citation. */
export type BannedBookChallenge = {
  readonly state: string;
  readonly jurisdictionLabel?: string;
  readonly schoolYear?: string;
  readonly challengeYear?: number;
  readonly status: BannedBookChallengeStatus;
  readonly citation: BannedBookCitation;
};

/** Archive retrieval evidence for the listing row itself. */
export type BannedBookProvenance = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

/** One curated banned-or-challenged book row in the listing snapshot. */
export type BannedBookRecord = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authors: readonly BannedBookAuthor[];
  readonly identifiers: readonly BannedBookIdentifier[];
  readonly description: string;
  readonly publishedDate: string;
  readonly challenges: readonly BannedBookChallenge[];
  readonly citations: readonly BannedBookCitation[];
  readonly purchaseLinks: readonly BannedBookPurchaseLink[];
  readonly canonicalEntityId?: string;
  readonly provenance: BannedBookProvenance;
};

/** Versioned export of the full banned-books listing corpus. */
export type BannedBooksListingSnapshot = {
  readonly version: string;
  readonly generatedAt: string;
  readonly books: readonly BannedBookRecord[];
};

/** Stable snapshot name used by datapack and publication pipelines. */
export const BANNED_BOOKS_SNAPSHOT_NAME = 'bannedBooksListing';

/** Minimum independent citations required before a record may publish. */
export const MIN_BANNED_BOOK_CITATIONS = 3;

/** Maximum retailer links attached to one record. */
export const MAX_BANNED_BOOK_PURCHASE_LINKS = 3;
