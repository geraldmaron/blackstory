/**
 * Tests for books browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import {
  BOOKS_BROWSE_PAGE_SIZE,
  buildBooksBrowseViewModel,
  buildBooksDetailViewModel,
} from './books-view-model';

const SNAPSHOT = getBannedBooksListingSnapshot();

test('buildBooksBrowseViewModel returns all seed entries by default', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {});
  assert.equal(view.totalMatched, 58);
  assert.equal(view.state, 'all');
  assert.equal(view.author, 'all');
  assert.equal(view.items.length, Math.min(BOOKS_BROWSE_PAGE_SIZE, view.totalMatched));
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

test('buildBooksBrowseViewModel filters by q on summary text', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { q: 'pecola' });
  assert.equal(view.totalMatched, 1);
  assert.equal(view.items[0]?.slug, 'the-bluest-eye');
  assert.match(view.items[0]?.summary.toLowerCase() ?? '', /pecola/);
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
  assert.ok(item.summary.length >= 40);
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

  assert.ok(item.purchaseLinks.length >= 1);
  assert.equal(item.purchaseLinks[0]?.retailer, 'bookshop');
  assert.match(item.purchaseLinks[0]?.href ?? '', /bookshop\.org\/a\/gerald69\//);
});

test('buildBooksBrowseViewModel filters by author', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { author: 'Toni Morrison' });
  assert.equal(view.totalMatched, 4);
  for (const item of view.items) {
    assert.equal(item.authorNames, 'Toni Morrison');
  }
});

test('buildBooksBrowseViewModel returns empty when nothing matches', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { q: 'zzzz-not-a-book' });
  assert.equal(view.totalMatched, 0);
  assert.equal(view.items.length, 0);
});

test('buildBooksBrowseViewModel defaults to title ascending', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {});
  assert.equal(view.sort, 'title');
  assert.equal(view.dir, 'asc');
  assert.ok(view.items.length >= 2);
  const titles = view.items.map((item) => item.title);
  const sorted = [...titles].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }),
  );
  assert.deepEqual(titles, sorted);
  const titleOpt = view.sortOptions.find((option) => option.key === 'title');
  assert.equal(titleOpt?.ariaSort, 'ascending');
  assert.match(titleOpt?.href ?? '', /dir=desc/);
});

test('buildBooksBrowseViewModel sorts by author descending', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { sort: 'author', dir: 'desc' });
  assert.equal(view.sort, 'author');
  assert.equal(view.dir, 'desc');
  const authors = view.items.map((item) => item.authorNames);
  const sorted = [...authors].sort((left, right) =>
    right.localeCompare(left, undefined, { sensitivity: 'base' }),
  );
  assert.deepEqual(authors, sorted);
});

test('buildBooksBrowseViewModel sorts by citation count', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { sort: 'citations', dir: 'desc' });
  for (let index = 1; index < view.items.length; index += 1) {
    assert.ok(view.items[index - 1]!.citationCount >= view.items[index]!.citationCount);
  }
});

test('sort option hrefs preserve active filters and reset page', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {
    q: 'eye',
    state: 'FL',
    author: 'Toni Morrison',
    sort: 'year',
    dir: 'asc',
    page: '2',
  });
  const yearOpt = view.sortOptions.find((option) => option.key === 'year');
  assert.ok(yearOpt);
  assert.match(yearOpt.href, /q=eye/);
  assert.match(yearOpt.href, /state=FL/);
  assert.match(yearOpt.href, /author=Toni(\+|%20)Morrison/);
  assert.match(yearOpt.href, /dir=desc/);
  assert.doesNotMatch(yearOpt.href, /page=/);
});

test('buildBooksBrowseViewModel paginates results', () => {
  const page1 = buildBooksBrowseViewModel(SNAPSHOT, {});
  assert.equal(page1.page, 1);
  assert.equal(page1.items.length, BOOKS_BROWSE_PAGE_SIZE);
  assert.ok(page1.pagination.totalPages >= 2);
  assert.equal(page1.pagination.previousHref, undefined);
  assert.ok(page1.pagination.nextHref);

  const page2 = buildBooksBrowseViewModel(SNAPSHOT, { page: '2' });
  assert.equal(page2.page, 2);
  assert.ok(page2.items.length >= 1);
  assert.notEqual(page2.items[0]?.id, page1.items[0]?.id);
  assert.ok(page2.pagination.previousHref);
  assert.match(page2.pagination.previousHref ?? '', /\/books$/);
});

test('buildBooksBrowseViewModel clamps out-of-range pages', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { page: '999' });
  assert.equal(view.page, view.pagination.totalPages);
  assert.equal(view.pagination.nextHref, undefined);
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
