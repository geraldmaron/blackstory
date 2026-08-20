/**
 * Books v6 page wiring: shared gutter mosaic, rip rows, anatomy strip, preserved browse URL contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BOOKS_ABOUT, BOOKS_CATALOG, BOOKS_INTRO } from './books-copy';

const here = dirname(fileURLToPath(import.meta.url));
const browseSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const detailSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');
const browseSectionsSource = readFileSync(join(here, 'BooksBrowseSections.tsx'), 'utf8');
const ripRowSource = readFileSync(join(here, 'BooksRipRow.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'books-copy.ts'), 'utf8');

test('books browse page renders through the room kit, with the catalog pulse kept', () => {
  assert.doesNotMatch(browseSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(browseSource, /BOOKS_EDITION_MOSAIC_SEED/);
  // The v6 edition root and its `data-books-edition` marker are gone: the room is drawn by the
  // shared kit now, and a second per-route chrome is what the kit exists to retire.
  assert.doesNotMatch(browseSource, /booksEditionRootClassName/);
  assert.doesNotMatch(browseSource, /data-books-edition="v6"/);
  assert.match(browseSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(browseSource, /<Room>/);
  assert.match(browseSource, /<RoomHeader/);
  // The pulse is this room's own content, not chrome, so the conversion must not have dropped it.
  assert.match(browseSource, /BooksCatalogPulse/);
});

test('books detail page uses anatomy strip and cover art without gutter mosaic', () => {
  assert.doesNotMatch(detailSource, /EditionAtmosphereMosaic/);
  assert.doesNotMatch(detailSource, /BOOKS_EDITION_MOSAIC_SEED/);
  assert.match(detailSource, /BooksAnatomyStrip/);
  assert.match(detailSource, /BooksCoverArt/);
  assert.match(detailSource, /buildBooksRelatedItems/);
  assert.doesNotMatch(detailSource, /ds-entity-mast/);
});

test('books detail page renders through the room kit, with no edition chrome left', () => {
  const detailSectionsSource = readFileSync(join(here, 'BooksDetailSections.tsx'), 'utf8');
  assert.doesNotMatch(detailSource, /books-panel-chrome/);
  assert.doesNotMatch(detailSource, /books-edition\.css/);
  assert.doesNotMatch(detailSource, /data-books-edition="v6"/);
  assert.match(detailSource, /from '\.\.\/\.\.\/\.\.\/components\/room'/);
  assert.match(detailSource, /<Room>/);
  assert.match(detailSource, /<RoomHeader/);
  assert.doesNotMatch(detailSectionsSource, /books-panel-chrome/);
  // The route-owned box wrapper (`ds-books-edition__panel--<variant>`) is gone; the element
  // labels it left behind (`__panel-title`, `__panel-heading`) are content, not chrome, and stay.
  assert.doesNotMatch(detailSectionsSource, /ds-books-edition__panel--/);
});

test('books browse renders its rows through the shared index, not a bespoke row', () => {
  // SP-11c moved the browse list onto `HairlineIndex`, the same block `/records` renders, so the
  // rows and the facet chips carry one vocabulary instead of two. `BooksRipRow` survives because
  // `/books/[slug]` still renders it for related titles; it is the BROWSE page that stopped.
  assert.match(browseSectionsSource, /HairlineIndex/);
  assert.doesNotMatch(browseSectionsSource, /BooksRipRow/);
  assert.match(browseSectionsSource, /BooksCoverArt/);
  assert.match(ripRowSource, /BooksCoverArt/);
});

test('books browse facet chips use the room kit chip vocabulary', () => {
  // The drift guard: chips here must be the kit's, never a books-only chip class resurrected
  // from the retired edition sheet.
  assert.match(browseSectionsSource, /IndexFilter|ds-room-chip/);
  assert.doesNotMatch(browseSectionsSource, /ds-books-edition__filter-chip/);
});

test('books browse preserves GET filter and sort URL contract', () => {
  assert.match(browseSectionsSource, /method="get"/);
  assert.match(browseSectionsSource, /action="\/books"/);
  assert.match(browseSectionsSource, /BooksSearchTypeahead/);
  assert.match(browseSectionsSource, /name="state"/);
  assert.match(browseSectionsSource, /name="author"/);
  assert.match(browseSectionsSource, /name="sort"/);
  assert.match(browseSectionsSource, /name="dir"/);
});

test('books user-facing copy avoids em dashes on touched surfaces', () => {
  const sources = [browseSource, detailSource, browseSectionsSource, copySource];
  for (const source of sources) {
    assert.doesNotMatch(source, /—/);
  }
  assert.equal(BOOKS_INTRO.kicker, 'Reference');
  assert.equal(BOOKS_CATALOG.title, 'Challenged titles');
  assert.equal(BOOKS_ABOUT.title, 'How to read this list');
});
