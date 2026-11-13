/**
 * Tests for books browse/detail view-model shaping.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import {
  BOOKS_SORT_PRESETS,
  buildBooksBrowseHref,
  buildBooksBrowseViewModel,
  buildBooksDetailViewModel,
  buildBooksRelatedItems,
} from './books-view-model';

const SNAPSHOT = getBannedBooksListingSnapshot();

/**
 * Host and path checked separately from a parsed URL. A single unanchored pattern over the whole
 * href also matches `https://evil.example/?r=bookshop.org/a/gerald69/`, which is the affiliate
 * link the reader is not getting (CodeQL js/regex/missing-regexp-anchor).
 */
function assertAffiliateLink(href: string | undefined): void {
  assert.ok(href, 'expected a purchase link');
  const url = new URL(href);
  assert.equal(url.hostname, 'bookshop.org');
  assert.ok(url.pathname.startsWith('/a/gerald69/'), `unexpected affiliate path: ${url.pathname}`);
}

test('buildBooksBrowseViewModel returns all seed entries by default', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {});
  assert.equal(view.totalMatched, 77);
  assert.equal(view.state, 'all');
  assert.equal(view.author, 'all');
  // The whole catalog is one page: the wall shows every title.
  assert.equal(view.items.length, view.totalMatched);
  assert.equal(view.view, 'covers');
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
  assertAffiliateLink(detail.book.purchaseLinks[0]?.href);

  assert.ok(item.purchaseLinks.length >= 1);
  assert.equal(item.purchaseLinks[0]?.retailer, 'bookshop');
  assertAffiliateLink(item.purchaseLinks[0]?.href);
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
  assert.equal(view.sortLabel, 'Title, A to Z');
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

test('every sort preset is a real order, and an order only an old link carries still reads', () => {
  for (const preset of BOOKS_SORT_PRESETS) {
    const view = buildBooksBrowseViewModel(SNAPSHOT, { sort: preset.sort, dir: preset.dir });
    assert.equal(view.sortLabel, preset.label);
  }
  assert.equal(
    buildBooksBrowseViewModel(SNAPSHOT, { sort: 'title', dir: 'desc' }).sortLabel,
    'Title, descending',
  );
});

test('the browse href keeps every narrowing and the view, and drops defaults', () => {
  assert.equal(
    buildBooksBrowseHref({
      q: 'x',
      state: 'FL',
      author: 'Toni Morrison',
      sort: 'year',
      dir: 'desc',
      view: 'states',
    }),
    '/books?q=x&state=FL&author=Toni+Morrison&sort=year&dir=desc&view=states',
  );
  assert.equal(
    buildBooksBrowseHref({ q: '', state: 'all', author: 'all', sort: 'title', dir: 'asc' }),
    '/books',
  );
});

test('state counts are counted within search and author, not narrowed by the state itself', () => {
  const all = buildBooksBrowseViewModel(SNAPSHOT, {});
  const florida = buildBooksBrowseViewModel(SNAPSHOT, { state: 'FL', view: 'states' });
  assert.equal(florida.view, 'states');
  assert.deepEqual(florida.stateCounts, all.stateCounts);
  const fl = all.stateCounts.find((entry) => entry.code === 'FL');
  assert.equal(fl?.count, florida.totalMatched, 'a state count is what its link shows');
  for (let i = 1; i < all.stateCounts.length; i += 1) {
    assert.ok(all.stateCounts[i - 1]!.count >= all.stateCounts[i]!.count);
  }
  const morrison = buildBooksBrowseViewModel(SNAPSHOT, { author: 'Toni Morrison' });
  const sum = morrison.stateCounts.reduce((total, entry) => total + entry.count, 0);
  assert.equal(
    sum,
    morrison.items.reduce((total, item) => total + item.states.length, 0),
  );
});

test('every state on the tile grid is a real USPS code, at its own square', async () => {
  const { STATE_TILES } = await import('./state-tiles');
  const { US_STATES } = await import('@repo/domain/map/geography');
  const codes = new Set(US_STATES.map((state) => state.postalCode));
  const squares = new Set<string>();
  for (const [code, [row, column]] of Object.entries(STATE_TILES)) {
    assert.ok(codes.has(code), `${code} is not a state code`);
    assert.ok(row >= 0 && row < 8 && column >= 0 && column < 11);
    squares.add(`${row},${column}`);
  }
  assert.equal(Object.keys(STATE_TILES).length, 51);
  assert.equal(squares.size, 51, 'two states share a square');
  for (const entry of buildBooksBrowseViewModel(SNAPSHOT, {}).stateCounts) {
    assert.ok(STATE_TILES[entry.code], `${entry.code} has no tile`);
  }
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

test('buildBooksBrowseViewModel exposes cover ISBN and challenge counts on items', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, { q: 'bluest' });
  const item = view.items[0];
  assert.ok(item);
  assert.equal(item.slug, 'the-bluest-eye');
  assert.equal(item.coverIsbn, '9780307278449');
  assert.ok(item.challengeCount >= 1);
});

test('buildBooksRelatedItems returns same-author titles excluding current', () => {
  const detail = buildBooksDetailViewModel(SNAPSHOT, 'the-bluest-eye');
  assert.equal(detail.kind, 'ok');
  if (detail.kind !== 'ok') return;
  const related = buildBooksRelatedItems(SNAPSHOT, detail.book);
  assert.ok(related.length >= 1);
  assert.ok(related.every((item) => item.slug !== 'the-bluest-eye'));
  assert.ok(related.some((item) => item.authorNames.includes('Toni Morrison')));
});
