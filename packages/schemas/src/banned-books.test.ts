/**
 * Tests for banned-books listing Zod schemas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BANNED_BOOKS_SNAPSHOT_NAME,
  bannedBookRecordSchema,
  bannedBooksListingSnapshotSchema,
} from './banned-books.ts';

const sampleCitation = {
  label: 'PEN America Index',
  href: 'https://pen.org/banned-books',
  publisher: 'PEN America',
  publishedAt: '2024-09-01',
};

const sampleProvenance = {
  source: 'PEN America',
  sourceUrl: 'https://pen.org/banned-books',
  retrievedAt: '2025-01-15T12:00:00.000Z',
  contentHash: 'abc123def456',
};

const sampleRecord = {
  id: 'book-beloved',
  slug: 'beloved-toni-morrison',
  title: 'Beloved',
  authors: [{ name: 'Toni Morrison', role: 'author' as const }],
  identifiers: [{ system: 'isbn-13' as const, value: '9781400033416' }],
  description:
    'A Pulitzer Prize-winning novel about Sethe, a formerly enslaved woman haunted by the legacy of slavery and the ghost of her daughter in post-Civil War Ohio.',
  publishedDate: '1987',
  challenges: [
    {
      state: 'TX',
      jurisdictionLabel: 'Katy ISD',
      schoolYear: '2023-2024',
      challengeYear: 2023,
      status: 'reported' as const,
      citation: sampleCitation,
    },
  ],
  citations: [sampleCitation, { ...sampleCitation, label: 'District board minutes' }, { ...sampleCitation, label: 'Local news report' }],
  purchaseLinks: [
    {
      retailer: 'bookshop' as const,
      label: 'Buy on Bookshop.org',
      href: 'https://bookshop.org/a/gerald69/9781400033416',
      validationStatus: 'valid' as const,
    },
    {
      retailer: 'open-library' as const,
      label: 'Open Library',
      href: 'https://openlibrary.org/works/OL45804W',
      validationStatus: 'valid' as const,
    },
  ],
  provenance: sampleProvenance,
};

test('BANNED_BOOKS_SNAPSHOT_NAME matches publication pipeline key', () => {
  assert.equal(BANNED_BOOKS_SNAPSHOT_NAME, 'bannedBooksListing');
});

test('bannedBookRecordSchema accepts a valid record', () => {
  const parsed = bannedBookRecordSchema.parse(sampleRecord);
  assert.equal(parsed.slug, 'beloved-toni-morrison');
  assert.equal(parsed.authors.length, 1);
  assert.equal(parsed.citations.length, 3);
});

test('bannedBookRecordSchema accepts YYYY-MM-DD publishedDate', () => {
  const parsed = bannedBookRecordSchema.parse({
    ...sampleRecord,
    publishedDate: '1987-09-02',
  });
  assert.equal(parsed.publishedDate, '1987-09-02');
});

test('bannedBookRecordSchema rejects invalid slug, state, and description bounds', () => {
  assert.throws(() =>
    bannedBookRecordSchema.parse({ ...sampleRecord, slug: 'Beloved_Title' }),
  );
  assert.throws(() =>
    bannedBookRecordSchema.parse({
      ...sampleRecord,
      challenges: [{ ...sampleRecord.challenges[0], state: 'Texas' }],
    }),
  );
  assert.throws(() =>
    bannedBookRecordSchema.parse({
      ...sampleRecord,
      challenges: [{ ...sampleRecord.challenges[0], state: 'XX' }],
    }),
  );
  assert.throws(() =>
    bannedBookRecordSchema.parse({
      ...sampleRecord,
      description: 'Too short.',
    }),
  );
  assert.throws(() =>
    bannedBookRecordSchema.parse({
      ...sampleRecord,
      description: 'x'.repeat(601),
    }),
  );
});

test('bannedBookRecordSchema enforces citation and purchase link limits', () => {
  assert.throws(() =>
    bannedBookRecordSchema.parse({
      ...sampleRecord,
      citations: [sampleCitation, { ...sampleCitation, label: 'Second' }],
    }),
  );
  assert.throws(() =>
    bannedBookRecordSchema.parse({
      ...sampleRecord,
      purchaseLinks: [
        { retailer: 'amazon' as const, label: 'Amazon', href: 'https://amazon.com/a' },
        { retailer: 'amazon' as const, label: 'Amazon 2', href: 'https://amazon.com/b' },
        { retailer: 'amazon' as const, label: 'Amazon 3', href: 'https://amazon.com/c' },
        { retailer: 'amazon' as const, label: 'Amazon 4', href: 'https://amazon.com/d' },
      ],
    }),
  );
});

test('bannedBooksListingSnapshotSchema validates versioned corpus envelope', () => {
  const parsed = bannedBooksListingSnapshotSchema.parse({
    version: '1.0.0',
    generatedAt: '2025-01-15T12:00:00.000Z',
    books: [sampleRecord],
  });
  assert.equal(parsed.books.length, 1);
  assert.equal(parsed.version, '1.0.0');
});
