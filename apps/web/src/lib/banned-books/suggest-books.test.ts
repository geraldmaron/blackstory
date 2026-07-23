/**
 * Unit tests for banned-book typeahead ranking (title / author / summary tiers).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  suggestBannedBooks,
  type BannedBookSuggestCorpusItem,
} from './suggest-books.js';
const CORPUS: readonly BannedBookSuggestCorpusItem[] = [
  {
    id: 'bb_1',
    slug: 'the-bluest-eye',
    title: 'The Bluest Eye',
    authorNames: 'Toni Morrison',
    summary: 'A young girl in Ohio longs for blue eyes.',
  },
  {
    id: 'bb_2',
    slug: 'beloved',
    title: 'Beloved',
    authorNames: 'Toni Morrison',
    summary: 'A mother haunted by the past after emancipation.',
  },
  {
    id: 'bb_3',
    slug: 'between-the-world-and-me',
    title: 'Between the World and Me',
    authorNames: 'Ta-Nehisi Coates',
    summary: 'A letter on race and American history.',
  },
];

test('suggestBannedBooks returns empty for short queries', () => {
  assert.deepEqual(suggestBannedBooks('t', CORPUS), []);
});

test('suggestBannedBooks ranks title prefix ahead of summary hits', () => {
  const hits = suggestBannedBooks('belov', CORPUS);
  assert.equal(hits[0]?.slug, 'beloved');
});

test('suggestBannedBooks matches authors', () => {
  const hits = suggestBannedBooks('morrison', CORPUS);
  assert.equal(hits.length, 2);
  assert.ok(hits.every((hit) => hit.authorNames.includes('Morrison')));
});

test('suggestBannedBooks matches summary text at lower tier', () => {
  const hits = suggestBannedBooks('emancipation', CORPUS);
  assert.equal(hits[0]?.slug, 'beloved');
});
