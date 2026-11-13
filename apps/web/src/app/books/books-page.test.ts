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
const indexSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const detailSource = readFileSync(join(here, '[slug]', 'page.tsx'), 'utf8');
const browseSectionsSource = readFileSync(join(here, 'BooksBrowseSections.tsx'), 'utf8');
const ripRowSource = readFileSync(join(here, 'BooksRipRow.tsx'), 'utf8');
const copySource = readFileSync(join(here, 'books-copy.ts'), 'utf8');

test('books index is the catalog room; /books/browse is a config redirect only', () => {
  assert.match(indexSource, /BooksBrowseSections/);
  assert.match(indexSource, /<PageHeader/);
  assert.match(indexSource, /BooksCatalogPulse/);
  assert.doesNotMatch(indexSource, /RoomStats/);
  assert.doesNotMatch(indexSource, /OrientationInstrument/);
  assert.doesNotMatch(indexSource, /how-it-works|BooksHubSections/);
  assert.doesNotMatch(indexSource, /EditionAtmosphereMosaic|BOOKS_EDITION_MOSAIC_SEED/);
});

test('books browse ends on the catalog, without the BlackStory off-ramp card', () => {
  assert.doesNotMatch(indexSource, /WalkOffRamp/);
  // The room opens on a sentence, so the crumb (Rooms) is where the room's parent appears.
  assert.match(indexSource, /crumb=\{parentCrumb\('\/books'\)\}/);
  assert.match(indexSource, /title="The books someone asked to remove"/);
  assert.doesNotMatch(indexSource, /Open the Atlas|ATLAS_INSTRUMENT|label: 'The place'/);
  assert.doesNotMatch(indexSource, /['"`]\/banned-books/);
  assert.doesNotMatch(indexSource, /Archive texture|Mosaic credits|ATMOSPHERE_ATTRIBUTION/);
  assert.doesNotMatch(indexSource, /Straight to the records|The Atlas answers where and when/);
  assert.doesNotMatch(indexSource, /\/explore/);
  assert.doesNotMatch(detailSource, /WalkOffRamp/);
  assert.doesNotMatch(detailSource, /Open the Atlas|ATLAS_INSTRUMENT|label: 'The place'/);
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
  assert.match(detailSource, /<Room width="record">/);
  assert.match(detailSource, /<PageHeader/);
  assert.doesNotMatch(detailSectionsSource, /books-panel-chrome/);
  // The route-owned box wrapper (`ds-books-edition__panel--<variant>`) is gone; the element
  // labels it left behind (`__panel-title`, `__panel-heading`) are content, not chrome, and stay.
  assert.doesNotMatch(detailSectionsSource, /ds-books-edition__panel--/);
});

test('books browse renders cover-led kit rows, not the retired rip row or HairlineIndex', () => {
  // Catalog indexes share `ds-room-idx` slots. Books cannot use HairlineIndex: that block's
  // glyph track is a 16px icon and its name clips to one line, which is how this catalog
  // read as a pin list. Related titles on the detail page still use BooksRipRow.
  assert.match(browseSectionsSource, /ds-books-idx/);
  assert.match(browseSectionsSource, /BooksCoverArt/);
  assert.match(browseSectionsSource, /ds-books-idx__gloss/);
  assert.doesNotMatch(browseSectionsSource, /HairlineIndex/);
  assert.doesNotMatch(browseSectionsSource, /BooksRipRow/);
  assert.match(ripRowSource, /BooksCoverArt/);
});

test('books browse facet chips use the room kit chip vocabulary', () => {
  // The drift guard: chips here must be the kit's, never a books-only chip class resurrected
  // from the retired edition sheet.
  assert.match(browseSectionsSource, /<FindBar/);
  assert.doesNotMatch(browseSectionsSource, /ds-books-browse/);
  assert.doesNotMatch(browseSectionsSource, /ds-books-edition__filter-chip/);
});

test('books browse preserves GET filter and sort URL contract', () => {
  // method="get", name="q" and the absence of an Apply button are the FindBar's, asserted on the
  // rendered component in room-kit.test.tsx. This pins what /books hands it.
  assert.match(browseSectionsSource, /<FindBar/);
  assert.match(browseSectionsSource, /action="\/books#browse"/);
  assert.match(browseSectionsSource, /id="browse"/);
  assert.match(browseSectionsSource, /BooksSearchTypeahead/);
  assert.match(browseSectionsSource, /name="state"/);
  assert.match(browseSectionsSource, /name="author"/);
  assert.match(browseSectionsSource, /preserved=\{\{ sort: view\.sort, dir: view\.dir \}\}/);
  assert.match(browseSectionsSource, /sortOptions\.map/);
  assert.match(browseSectionsSource, /clearHref="\/books#browse"/);
});

test('books user-facing copy avoids em dashes on touched surfaces', () => {
  const sources = [indexSource, detailSource, browseSectionsSource, copySource];
  for (const source of sources) {
    assert.doesNotMatch(source, /—/);
  }
  assert.equal(BOOKS_INTRO.kicker, 'Reference');
  assert.equal(BOOKS_CATALOG.title, 'Challenged titles');
  assert.equal(BOOKS_ABOUT.title, 'How to read this list');
});

test('the catalog room states the census limit and does not speak as an institution', () => {
  assert.match(indexSource, /BOOKS_INDEX_LEDE/);
  assert.doesNotMatch(indexSource, /\bWe could not\b/);
  assert.doesNotMatch(indexSource, /\bour side\b/);
  assert.match(browseSectionsSource, /BOOKS_ABOUT/);
  assert.doesNotMatch(browseSectionsSource, /RoomJump/);
  assert.match(browseSectionsSource, /id="read"/);
  assert.match(browseSectionsSource, /id="browse"/);
  assert.match(browseSectionsSource, /name="state"/);
});
