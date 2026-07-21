/**
 * Tests for books browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import {
  buildBooksBrowseViewModel,
  buildBooksDetailViewModel,
} from './books-view-model';

const SNAPSHOT = getBannedBooksListingSnapshot();

test('buildBooksBrowseViewModel returns all seed entries by default', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {});
  assert.equal(view.totalMatched, 10);
  assert.equal(view.state, 'all');
  assert.equal(view.author, 'all');
});

test('buildBooksBrowseViewModel filters by q on title', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { q: 'bluest' });
  assert.equal(view.totalMatched, 1);
  assert.equal(view.items[0]?.slug, 'the-bluest-eye');
});

test('buildBooksBrowseViewModel filters by q on author', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { q: 'morrison' });
  assert.ok(view.totalMatched >= 2);
  for (const item of view.items) {
    assert.match(item.authorNames.toLowerCase(), /morrison/);
  }
});

test('buildBooksBrowseViewModel filters by state', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { state: 'FL' });
  assert.ok(view.totalMatched >= 1);
  for (const item of view.items) {
    assert.ok(item.states.some((entry) => entry.code === 'FL'));
  }
});

test('browse and detail expose validated USPS state names for challenge lists', () => {
  const browse = buildBooksBrowseViewModel(SNAPSHOT, { q: 'bluest' });
  const item = browse.items[0];
  assert.ok(item);
  assert.ok(item.states.length >= 1);
  for (const state of item.states) {
    assert.match(state.code, /^[A-Z]{2}$/);
    assert.ok(state.name.length > 2);
  }

  const detail = buildBooksDetailViewModel(SNAPSHOT, 'the-bluest-eye');
  assert.equal(detail.kind, 'ok');
  if (detail.kind !== 'ok') return;
  assert.ok(detail.states.some((entry) => entry.code === 'FL' && entry.name === 'Florida'));
  assert.equal(detail.book.purchaseLinks[0]?.retailer, 'bookshop');
  assert.match(detail.book.purchaseLinks[0]?.href ?? '', /bookshop\.org\/a\/gerald69\//);
});

test('buildBooksBrowseViewModel filters by author', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { author: 'Toni Morrison' });
  assert.equal(view.totalMatched, 2);
  for (const item of view.items) {
    assert.equal(item.authorNames, 'Toni Morrison');
  }
});

test('buildBooksBrowseViewModel returns empty when nothing matches', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { q: 'zzzz-not-a-book' });
  assert.equal(view.totalMatched, 0);
  assert.equal(view.items.length, 0);
});

test('buildBooksDetailViewModel resolves a known slug', () => {
  const view = buildBooksDetailViewModel(SNAPSHOT, 'the-bluest-eye');
  assert.equal(view.kind, 'ok');
  if (view.kind !== 'ok') return;
  assert.equal(view.book.title, 'The Bluest Eye');
  assert.ok(view.states.length >= 1);
  assert.ok(view.states.some((entry) => entry.code === 'FL'));
});

test('buildBooksDetailViewModel returns not_found for unknown slug', () => {
  const view = buildBooksDetailViewModel(SNAPSHOT, 'does-not-exist');
  assert.equal(view.kind, 'not_found');
});
