/**
 * Unit tests for the banned-books refresh job: valid catalog rows, purchase-link invalidation,
 * and structural validation error handling.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildIsbnPurchaseLinks,
  type BannedBookRecord,
} from '@repo/domain';
import { runBannedBooksRefreshJob } from './banned-books-refresh.ts';

const CITATION = {
  label: 'PEN America Index',
  href: 'https://pen.org/banned-books/',
  publisher: 'PEN America',
  publishedAt: '2024-01-01',
} as const;

const VALID_BOOK: BannedBookRecord = {
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

test('valid books pass validation and purchase links are marked valid when checkUrl succeeds', async () => {
  const result = await runBannedBooksRefreshJob({
    jobRunId: 'run-valid',
    startedAt: '2026-07-21T06:00:00.000Z',
    completedAt: '2026-07-21T06:05:00.000Z',
    books: [VALID_BOOK],
    checkUrl: async () => ({ ok: true, status: 200 }),
  });

  assert.equal(result.run.status, 'success');
  assert.equal(result.booksValidated, 1);
  assert.equal(result.validationErrors.length, 0);
  assert.ok(result.linksChecked > 0);
  assert.equal(result.linksInvalid, 0);
  assert.equal(result.linksValid, result.linksChecked);
  for (const link of result.updatedBooks[0]!.purchaseLinks) {
    assert.equal(link.validationStatus, 'valid');
    assert.equal(link.validatedAt, '2026-07-21T06:05:00.000Z');
  }
});

test('invalid purchase links are marked invalid while the book still validates structurally', async () => {
  const deadAmazonHref = VALID_BOOK.purchaseLinks[0]!.href;
  const result = await runBannedBooksRefreshJob({
    jobRunId: 'run-invalid-link',
    startedAt: '2026-07-21T06:00:00.000Z',
    completedAt: '2026-07-21T06:05:00.000Z',
    books: [VALID_BOOK],
    checkUrl: async (url) =>
      url === deadAmazonHref ? { ok: false, status: 404 } : { ok: true, status: 200 },
  });

  assert.equal(result.run.status, 'quarantined');
  assert.equal(result.booksValidated, 1);
  assert.equal(result.linksInvalid, 1);
  assert.equal(result.updatedBooks[0]!.purchaseLinks[0]!.validationStatus, 'invalid');
  assert.match(result.run.issues?.join(' ') ?? '', /link-invalid/);
});

test('structurally invalid books are recorded in validationErrors without link checks', async () => {
  const invalidBook = {
    ...VALID_BOOK,
    citations: VALID_BOOK.citations.slice(0, 2),
  };
  let checkCalls = 0;
  const result = await runBannedBooksRefreshJob({
    jobRunId: 'run-validation-error',
    startedAt: '2026-07-21T06:00:00.000Z',
    completedAt: '2026-07-21T06:05:00.000Z',
    books: [invalidBook],
    checkUrl: async () => {
      checkCalls += 1;
      return { ok: true, status: 200 };
    },
  });

  assert.equal(checkCalls, 0);
  assert.equal(result.booksValidated, 0);
  assert.equal(result.validationErrors.length, 1);
  assert.equal(result.validationErrors[0]?.bookId, invalidBook.id);
  assert.match(result.validationErrors[0]?.errors.join(' ') ?? '', /at least 3 citations/);
  assert.equal(result.run.status, 'quarantined');
  assert.deepEqual(result.updatedBooks[0], invalidBook);
});
