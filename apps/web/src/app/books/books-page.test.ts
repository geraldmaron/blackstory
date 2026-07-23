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

test('books browse page uses shared EditionAtmosphereMosaic and catalog pulse', () => {
  assert.match(browseSource, /EditionAtmosphereMosaic/);
  assert.match(browseSource, /BOOKS_EDITION_MOSAIC_SEED/);
  assert.match(browseSource, /booksEditionRootClassName/);
  assert.match(browseSource, /BooksCatalogPulse/);
  assert.match(browseSource, /data-books-edition="v6"/);
  assert.doesNotMatch(browseSource, /ds-books-page/);
});

test('books detail page uses per-slug mosaic seed, anatomy strip, and cover art', () => {
  assert.match(detailSource, /EditionAtmosphereMosaic/);
  assert.match(detailSource, /\$\{BOOKS_EDITION_MOSAIC_SEED\}:\$\{slug\}/);
  assert.match(detailSource, /BooksAnatomyStrip/);
  assert.match(detailSource, /BooksCoverArt/);
  assert.match(detailSource, /buildBooksRelatedItems/);
  assert.doesNotMatch(detailSource, /ds-entity-mast/);
});

test('books browse uses rip rows with fact stacks and active filter chips', () => {
  assert.match(browseSectionsSource, /BooksRipRow/);
  assert.match(browseSectionsSource, /BooksActiveFilters|active-filters/);
  assert.match(ripRowSource, /EditionFactIcon/);
  assert.match(ripRowSource, /BooksCoverArt/);
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
