/**
 * Banned-books catalog types for the native mobile Books surface.
 * Mirrors `@repo/domain` banned-books shapes without requiring Node seed tooling.
 */
export type BannedBookAuthor = {
  readonly name: string;
  readonly role?: 'author' | 'editor' | 'illustrator' | 'contributor';
};

export type BannedBookIdentifier = {
  readonly system: 'isbn-13' | 'isbn-10' | 'asin' | 'oclc' | 'open-library' | 'other';
  readonly value: string;
};

export type BannedBookCitation = {
  readonly label: string;
  readonly href: string;
  readonly publisher?: string;
  readonly publishedAt?: string;
};

export type BannedBookPurchaseLink = {
  readonly retailer: 'bookshop' | 'amazon' | 'barnes-noble' | 'open-library' | 'publisher' | 'other';
  readonly label: string;
  readonly href: string;
  readonly validatedAt?: string;
  readonly validationStatus?: 'valid' | 'invalid' | 'unchecked';
};

export type BannedBookChallengeStatus = 'reported' | 'rescinded' | 'unknown';

export type BannedBookChallenge = {
  readonly state: string;
  readonly jurisdictionLabel?: string;
  readonly schoolYear?: string;
  readonly challengeYear?: number;
  readonly status: BannedBookChallengeStatus;
  readonly citation: BannedBookCitation;
};

export type BannedBookProvenance = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

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

export type BannedBooksListingSnapshot = {
  readonly version: string;
  readonly generatedAt: string;
  /** Where this release came from (curated seed until a mobile listing API exists). */
  readonly source: 'curated-seed' | 'live-snapshot' | 'unavailable';
  readonly releaseLabel: string;
  readonly books: readonly BannedBookRecord[];
};

/** Compact row model for the browse ledger. */
export type BooksCatalogRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authorNames: string;
  readonly publishedDate: string;
  readonly summary: string;
  readonly statesLabel: string;
  readonly stateCodes: readonly string[];
  readonly citationCount: number;
  readonly challengeCount: number;
  readonly canonicalEntityId?: string;
};
