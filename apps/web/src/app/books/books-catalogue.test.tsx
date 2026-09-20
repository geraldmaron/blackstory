/**
 * Banned-books catalog browse: cover-led kit rows, GET facets, census limit on the page.
 *
 * Browse tools live on `/books`. `/books/browse` is a retired redirect.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import { BooksCoverArt } from './BooksCoverArt';
import { BooksBrowseSections } from './BooksBrowseSections';
import { buildBooksBrowseViewModel } from './books-view-model';
import { BOOKS_ABOUT, BOOKS_READ_FACTS } from './books-copy';

void React;

const here = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'BooksBrowseSections.tsx'), 'utf8');

function readerText(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&apos;|[‘’]/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const SNAPSHOT = getBannedBooksListingSnapshot();
const VIEW = buildBooksBrowseViewModel(SNAPSHOT, {});
const HTML = renderToStaticMarkup(
  <BooksBrowseSections view={VIEW} suggestCorpus={[]} snapshot={SNAPSHOT} />,
);
const TEXT = readerText(HTML);

test('cover art is aria-hidden by default and carries no competing accessible name', () => {
  const html = renderToStaticMarkup(<BooksCoverArt title="The Bluest Eye" size="S" />);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /alt="[^"]+"/, 'a decorative cover must not set a non-empty alt');
});

test('a catalog row is a link whose accessible name leads with the title, not the cover', () => {
  assert.match(HTML, /<span class="ds-room-idx__glyph" aria-hidden="true">/);
  assert.match(HTML, /<span class="ds-room-idx__name">/);
  assert.ok(VIEW.items.length > 0, 'seed catalog should have titles');
  assert.ok(TEXT.includes(VIEW.items[0]!.title), 'first page title never reached the reader');
});

test('facet chips render in the shared room-kit chip vocabulary, not a bespoke one', () => {
  assert.match(HTML, /class="ds-room-chip"/);
  assert.match(HTML, /ds-room-num/);
  assert.doesNotMatch(HTML, /ds-books-edition__filter-chip/);
  assert.doesNotMatch(sectionsSource, /ds-books-edition__filter-chip/);
});

test('the browse sections keep kit chips and a state select, not HairlineIndex', () => {
  assert.match(sectionsSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(sectionsSource, /ds-books-idx/);
  assert.match(sectionsSource, /sortOptions\.map/);
  // Chips, active constraints and the sort are the kit's FindBar; the state select rides in its form.
  assert.match(sectionsSource, /<FindBar/);
  assert.match(sectionsSource, /name="state"/);
  assert.doesNotMatch(sectionsSource, /HairlineIndex/);
  assert.doesNotMatch(sectionsSource, /ds-books-edition/);
});

test('how-to-read is on the page, with the census limit and the affiliate bound', () => {
  assert.ok(TEXT.includes(BOOKS_ABOUT.title));
  assert.ok(TEXT.includes(BOOKS_ABOUT.lede.slice(0, 40)));
  for (const fact of BOOKS_READ_FACTS) {
    assert.ok(TEXT.includes(fact.title), `missing fact "${fact.title}"`);
  }
  assert.match(HTML, /id="read"/);
  assert.match(HTML, /href="#read"/);
  assert.match(HTML, /href="#browse"/);
});

test('the rail dump of three states is gone; related rooms leave as handoffs', () => {
  assert.doesNotMatch(indexSource, /OrientationInstrument/);
  assert.doesNotMatch(HTML, /icon="place"|id="place"/);
  assert.match(HTML, /href="\/methodology"/);
  assert.match(HTML, /href="\/law"/);
  assert.match(HTML, /href="\/submit"/);
});

test('no link on the catalog page points at /history or another redirect endpoint', () => {
  for (const source of [indexSource, sectionsSource]) {
    assert.doesNotMatch(source, /href=["'`]\/history/);
    assert.doesNotMatch(source, /href=["'`]\/explore/);
    assert.doesNotMatch(source, /href=["'`]\/locate/);
    assert.doesNotMatch(source, /href=["'`]\/search["'`]/);
    assert.doesNotMatch(source, /href=["'`]\/map["'`]/);
  }
});

test('the unavailable-snapshot notice and the no-results empty state carry different copy', () => {
  assert.match(indexSource, /Notice/);
  assert.match(indexSource, /snapshot is unavailable/);
  assert.doesNotMatch(indexSource, /No titles matched/);
  assert.match(sectionsSource, /BOOKS_CATALOG\.emptyTitle/);
});

test('books-edition.css and books-panel-chrome.ts are gone', () => {
  assert.doesNotMatch(indexSource, /books-edition\.css/);
  assert.doesNotMatch(indexSource, /books-panel-chrome/);
  assert.doesNotMatch(sectionsSource, /books-edition\.css/);
  assert.doesNotMatch(sectionsSource, /books-panel-chrome/);
});
