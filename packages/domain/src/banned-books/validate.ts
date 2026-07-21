/**
 * Pure validators for banned-books listing records and snapshots. Uses assert/Result patterns
 * consistent with other @repo/domain modules — no zod dependency.
 */
import { US_STATES } from '../map/us-geography.js';
import {
  MAX_BANNED_BOOK_PURCHASE_LINKS,
  MIN_BANNED_BOOK_CITATIONS,
  type BannedBookRecord,
  type BannedBooksListingSnapshot,
} from './types.js';

const USPS_STATE_CODES = new Set(US_STATES.map((state) => state.postalCode));

const KEBAB_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEAR_PATTERN = /^\d{4}$/;
const YEAR_MONTH_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MIN_DESCRIPTION_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 600;

export type BannedBookValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isUspsStateCode(code: string): boolean {
  return USPS_STATE_CODES.has(code.toUpperCase());
}

function isKebabSlug(slug: string): boolean {
  return KEBAB_SLUG_PATTERN.test(slug);
}

function isPublishedDate(value: string): boolean {
  if (YEAR_PATTERN.test(value)) {
    return true;
  }
  if (!YEAR_MONTH_DAY_PATTERN.test(value)) {
    return false;
  }
  const [, month, day] = value.split('-');
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  return monthNumber >= 1 && monthNumber <= 12 && dayNumber >= 1 && dayNumber <= 31;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function collectBannedBookRecordErrors(book: BannedBookRecord): string[] {
  const errors: string[] = [];

  if (!isNonEmpty(book.title)) {
    errors.push('BannedBookRecord.title must be non-empty');
  }

  if (book.authors.length === 0) {
    errors.push('BannedBookRecord.authors must contain at least one author');
  } else {
    for (const [index, author] of book.authors.entries()) {
      if (!isNonEmpty(author.name)) {
        errors.push(`BannedBookRecord.authors[${index}].name must be non-empty`);
      }
    }
  }

  if (!isKebabSlug(book.slug)) {
    errors.push('BannedBookRecord.slug must be kebab-case (lowercase letters, digits, hyphens)');
  }

  if (book.description.length < MIN_DESCRIPTION_LENGTH || book.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `BannedBookRecord.description must be between ${MIN_DESCRIPTION_LENGTH} and ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }

  if (!isPublishedDate(book.publishedDate)) {
    errors.push('BannedBookRecord.publishedDate must be YYYY or YYYY-MM-DD');
  }

  if (book.citations.length < MIN_BANNED_BOOK_CITATIONS) {
    errors.push(
      `BannedBookRecord.citations must contain at least ${MIN_BANNED_BOOK_CITATIONS} citations`,
    );
  }

  for (const [index, citation] of book.citations.entries()) {
    if (!isNonEmpty(citation.label)) {
      errors.push(`BannedBookRecord.citations[${index}].label must be non-empty`);
    }
    if (!isHttpUrl(citation.href)) {
      errors.push(`BannedBookRecord.citations[${index}].href must be a valid http(s) URL`);
    }
  }

  if (book.purchaseLinks.length > MAX_BANNED_BOOK_PURCHASE_LINKS) {
    errors.push(
      `BannedBookRecord.purchaseLinks must contain at most ${MAX_BANNED_BOOK_PURCHASE_LINKS} links`,
    );
  }

  for (const [index, link] of book.purchaseLinks.entries()) {
    if (!isNonEmpty(link.label)) {
      errors.push(`BannedBookRecord.purchaseLinks[${index}].label must be non-empty`);
    }
    if (!isHttpUrl(link.href)) {
      errors.push(`BannedBookRecord.purchaseLinks[${index}].href must be a valid http(s) URL`);
    }
  }

  for (const [index, challenge] of book.challenges.entries()) {
    if (!isUspsStateCode(challenge.state)) {
      errors.push(
        `BannedBookRecord.challenges[${index}].state must be a valid USPS state code (50 states + DC)`,
      );
    }
    if (!isNonEmpty(challenge.citation.label)) {
      errors.push(`BannedBookRecord.challenges[${index}].citation.label must be non-empty`);
    }
    if (!isHttpUrl(challenge.citation.href)) {
      errors.push(
        `BannedBookRecord.challenges[${index}].citation.href must be a valid http(s) URL`,
      );
    }
  }

  if (!isNonEmpty(book.provenance.source)) {
    errors.push('BannedBookRecord.provenance.source must be non-empty');
  }
  if (!isHttpUrl(book.provenance.sourceUrl)) {
    errors.push('BannedBookRecord.provenance.sourceUrl must be a valid http(s) URL');
  }
  if (!isNonEmpty(book.provenance.retrievedAt)) {
    errors.push('BannedBookRecord.provenance.retrievedAt must be non-empty');
  }
  if (!isNonEmpty(book.provenance.contentHash)) {
    errors.push('BannedBookRecord.provenance.contentHash must be non-empty');
  }

  return errors;
}

export function assertBannedBookRecord(book: BannedBookRecord): void {
  const errors = collectBannedBookRecordErrors(book);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
}

export function validateBannedBookRecord(book: BannedBookRecord): BannedBookValidationResult {
  const errors = collectBannedBookRecordErrors(book);
  if (errors.length > 0) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  }
  return Object.freeze({ ok: true });
}

export function validateBannedBooksListing(
  snapshot: BannedBooksListingSnapshot,
): BannedBookValidationResult {
  const errors: string[] = [];

  if (!isNonEmpty(snapshot.version)) {
    errors.push('BannedBooksListingSnapshot.version must be non-empty');
  }
  if (!isNonEmpty(snapshot.generatedAt)) {
    errors.push('BannedBooksListingSnapshot.generatedAt must be non-empty');
  }

  for (const [index, book] of snapshot.books.entries()) {
    for (const message of collectBannedBookRecordErrors(book)) {
      errors.push(`books[${index}]: ${message}`);
    }
  }

  if (errors.length > 0) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  }
  return Object.freeze({ ok: true });
}

/**
 * Sorted unique validated USPS state codes from reported or unknown challenges.
 * Invalid codes are omitted (records should already fail `assertBannedBookRecord`).
 */
export function bannedBookReportedStates(book: BannedBookRecord): string[] {
  const states = new Set<string>();
  for (const challenge of book.challenges) {
    if (challenge.status !== 'reported' && challenge.status !== 'unknown') {
      continue;
    }
    const code = challenge.state.toUpperCase();
    if (!isUspsStateCode(code)) {
      continue;
    }
    states.add(code);
  }
  return [...states].sort((left, right) => left.localeCompare(right));
}
