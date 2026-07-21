/**
 * Tests for banned-books types validation, purchase-link builders, and state aggregation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BANNED_BOOKS_SNAPSHOT_NAME,
  MAX_BANNED_BOOK_PURCHASE_LINKS,
  MIN_BANNED_BOOK_CITATIONS,
  assertBannedBookRecord,
  bannedBookReportedStates,
  buildIsbnPurchaseLinks,
  markPurchaseLinkValidation,
  validateBannedBookRecord,
  validateBannedBooksListing,
  type BannedBookRecord,
  type BannedBooksListingSnapshot,
} from './index.js';

const CITATION = {
  label: 'PEN America Index',
  href: 'https://pen.org/banned-books/',
  publisher: 'PEN America',
  publishedAt: '2024-01-01',
} as const;

const BASE_BOOK: BannedBookRecord = {
  id: 'bb-test-001',
  slug: 'the-bluest-eye',
  title: 'The Bluest Eye',
  authors: [{ name: 'Toni Morrison', role: 'author' }],
  identifiers: [{ system: 'isbn-13', value: '9780307278449' }],
  description:
    'A novel following a young Black girl in 1940s Ohio as she confronts standards of beauty and belonging.',
  publishedDate: '1970',
  challenges: [
    {
      state: 'TX',
      jurisdictionLabel: 'Independent School District',
      schoolYear: '2023-2024',
      challengeYear: 2023,
      status: 'reported',
      citation: CITATION,
    },
    {
      state: 'FL',
      status: 'rescinded',
      citation: CITATION,
    },
  ],
  citations: [CITATION, { ...CITATION, label: 'NCAC Report' }, { ...CITATION, label: 'ALA Office' }],
  purchaseLinks: buildIsbnPurchaseLinks('9780307278449'),
  provenance: {
    source: 'PEN America',
    sourceUrl: 'https://pen.org/banned-books/',
    retrievedAt: '2026-07-01T00:00:00.000Z',
    contentHash: 'abc123',
  },
};

test('constants expose snapshot name and citation/purchase limits', () => {
  assert.equal(BANNED_BOOKS_SNAPSHOT_NAME, 'bannedBooksListing');
  assert.equal(MIN_BANNED_BOOK_CITATIONS, 3);
  assert.equal(MAX_BANNED_BOOK_PURCHASE_LINKS, 3);
});

test('a well-formed banned book record passes validation', () => {
  assert.doesNotThrow(() => assertBannedBookRecord(BASE_BOOK));
  assert.deepEqual(validateBannedBookRecord(BASE_BOOK), { ok: true });
});

test('assertBannedBookRecord rejects too few citations', () => {
  const invalid = { ...BASE_BOOK, citations: BASE_BOOK.citations.slice(0, 2) };
  assert.throws(() => assertBannedBookRecord(invalid), /at least 3 citations/);
  const result = validateBannedBookRecord(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(' '), /at least 3 citations/);
  }
});

test('assertBannedBookRecord rejects too many purchase links', () => {
  const invalid = {
    ...BASE_BOOK,
    purchaseLinks: [
      ...BASE_BOOK.purchaseLinks,
      {
        retailer: 'publisher' as const,
        label: 'Publisher',
        href: 'https://example.com/book',
      },
      {
        retailer: 'other' as const,
        label: 'Other',
        href: 'https://example.com/other',
      },
    ],
  };
  assert.throws(() => assertBannedBookRecord(invalid), /at most 3 links/);
});

test('assertBannedBookRecord rejects invalid challenge state', () => {
  const invalid = {
    ...BASE_BOOK,
    challenges: [{ ...BASE_BOOK.challenges[0], state: 'XX' }],
  };
  assert.throws(() => assertBannedBookRecord(invalid), /USPS state code/);
});

test('assertBannedBookRecord rejects non-kebab slug', () => {
  const invalid = { ...BASE_BOOK, slug: 'The_Bluest_Eye' };
  assert.throws(() => assertBannedBookRecord(invalid), /kebab-case/);
});

test('assertBannedBookRecord rejects description length out of range', () => {
  const tooShort = { ...BASE_BOOK, description: 'Too short.' };
  assert.throws(() => assertBannedBookRecord(tooShort), /between 40 and 600 characters/);

  const tooLong = { ...BASE_BOOK, description: 'x'.repeat(601) };
  assert.throws(() => assertBannedBookRecord(tooLong), /between 40 and 600 characters/);
});

test('assertBannedBookRecord rejects invalid publishedDate formats', () => {
  assert.throws(
    () => assertBannedBookRecord({ ...BASE_BOOK, publishedDate: '70' }),
    /YYYY or YYYY-MM-DD/,
  );
  assert.throws(
    () => assertBannedBookRecord({ ...BASE_BOOK, publishedDate: '1970-13-01' }),
    /YYYY or YYYY-MM-DD/,
  );
});

test('assertBannedBookRecord accepts YYYY-MM-DD publishedDate', () => {
  const dated = { ...BASE_BOOK, publishedDate: '1970-09-01' };
  assert.doesNotThrow(() => assertBannedBookRecord(dated));
});

test('assertBannedBookRecord rejects empty title and authors', () => {
  assert.throws(() => assertBannedBookRecord({ ...BASE_BOOK, title: '  ' }), /title must be non-empty/);
  assert.throws(
    () => assertBannedBookRecord({ ...BASE_BOOK, authors: [] }),
    /at least one author/,
  );
  assert.throws(
    () => assertBannedBookRecord({ ...BASE_BOOK, authors: [{ name: ' ' }] }),
    /authors\[0\]\.name must be non-empty/,
  );
});

test('validateBannedBooksListing validates snapshot envelope and nested books', () => {
  const snapshot: BannedBooksListingSnapshot = {
    version: '1.0.0',
    generatedAt: '2026-07-01T00:00:00.000Z',
    books: [BASE_BOOK],
  };
  assert.deepEqual(validateBannedBooksListing(snapshot), { ok: true });

  const invalid = {
    ...snapshot,
    version: '',
    books: [{ ...BASE_BOOK, slug: 'Bad Slug' }],
  };
  const result = validateBannedBooksListing(invalid);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(' '), /version must be non-empty/);
    assert.match(result.errors.join(' '), /books\[0\]: .*kebab-case/);
  }
});

test('buildIsbnPurchaseLinks returns Bookshop affiliate + Open Library links for ISBN-13', () => {
  const links = buildIsbnPurchaseLinks('978-0-307-27844-9');
  assert.equal(links.length, 2);
  assert.equal(links[0]?.retailer, 'bookshop');
  assert.equal(links[0]?.href, 'https://bookshop.org/a/gerald69/9780307278449');
  assert.equal(links[0]?.label, 'Buy on Bookshop.org');
  assert.equal(links[0]?.validationStatus, 'unchecked');
  assert.equal(links[1]?.retailer, 'open-library');
  assert.equal(links[1]?.href, 'https://openlibrary.org/isbn/9780307278449');
});

test('buildIsbnPurchaseLinks converts ISBN-10 for Bookshop but keeps 10 for Open Library', () => {
  const links = buildIsbnPurchaseLinks('0-307-27844-7');
  assert.equal(links[0]?.href, 'https://bookshop.org/a/gerald69/9780307278449');
  assert.equal(links[1]?.href, 'https://openlibrary.org/isbn/0307278447');
});

test('buildIsbnPurchaseLinks accepts an override affiliate id', () => {
  const links = buildIsbnPurchaseLinks('9780307278449', { bookshopAffiliateId: 'custom-id' });
  assert.equal(links[0]?.href, 'https://bookshop.org/a/custom-id/9780307278449');
});

test('bannedBookReportedStates omits rescinded and invalid codes', () => {
  assert.deepEqual(bannedBookReportedStates(BASE_BOOK), ['TX']);
  const withUnknown = {
    ...BASE_BOOK,
    challenges: [
      ...BASE_BOOK.challenges,
      {
        state: 'GA',
        status: 'unknown' as const,
        citation: CITATION,
      },
      {
        // Invalid codes should never reach publish; aggregation still filters them.
        state: 'XX',
        status: 'reported' as const,
        citation: CITATION,
      },
    ],
  };
  assert.deepEqual(bannedBookReportedStates(withUnknown), ['GA', 'TX']);
});

test('markPurchaseLinkValidation stamps status and validatedAt without mutating input', () => {
  const original = buildIsbnPurchaseLinks('9780307278449')[0];
  assert.ok(original);
  const marked = markPurchaseLinkValidation(original, 'valid', '2026-07-01T12:00:00.000Z');
  assert.equal(original.validationStatus, 'unchecked');
  assert.equal(marked.validationStatus, 'valid');
  assert.equal(marked.validatedAt, '2026-07-01T12:00:00.000Z');
});
