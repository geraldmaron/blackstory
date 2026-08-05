/**
 * SP-11c acceptance: `/books` catalogue index on the v9 room kit.
 *
 * Renders the pieces that can be rendered in isolation (`HairlineIndex` wired the way
 * `BooksBrowseSections` wires it, and `BooksCoverArt`) and reads the page source for the parts
 * that need real data plumbing (Postgres-backed snapshot loading), matching the pattern the
 * kit's own tests use.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HairlineIndex } from '../../components/room';
import { BooksCoverArt } from './BooksCoverArt';

void React;

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');
const sectionsSource = readFileSync(join(here, 'BooksBrowseSections.tsx'), 'utf8');

test('cover art is aria-hidden by default and carries no competing accessible name', () => {
  const html = renderToStaticMarkup(<BooksCoverArt title="The Bluest Eye" size="S" />);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /alt="[^"]+"/, 'a decorative cover must not set a non-empty alt');
});

test('a rip row is a link whose accessible name leads with the title, not the cover', () => {
  const html = renderToStaticMarkup(
    <HairlineIndex
      countLabel="1 title"
      rows={[
        {
          href: '/books/the-bluest-eye',
          name: 'The Bluest Eye',
          place: 'Toni Morrison',
          era: '1970',
          glyph: <BooksCoverArt title="The Bluest Eye" size="S" />,
        },
      ]}
    />,
  );
  assert.match(html, /<span class="ds-room-idx__glyph" aria-hidden="true">/);
  assert.match(html, /<span class="ds-room-idx__name">The Bluest Eye<\/span>/);
});

test('facet chips render in the shared room-kit chip vocabulary, not a bespoke one', () => {
  const html = renderToStaticMarkup(
    <HairlineIndex
      countLabel="3 titles"
      filters={[
        { id: 'all', label: 'All states', count: 3, href: '/books' },
        { id: 'TX', label: 'Texas (TX)', count: 2, href: '/books?state=TX' },
      ]}
      activeFilterId="all"
      rows={[]}
    />,
  );
  assert.match(html, /<a class="ds-room-chip" href="\/books\?state=TX"/);
  assert.match(html, /ds-room-num/);
  assert.doesNotMatch(html, /ds-books-edition__filter-chip/, 'the v6 chip class must not return');
});

test('the browse sections build the shared HairlineIndex filters, not a bespoke chip bar', () => {
  assert.match(sectionsSource, /from '\.\.\/\.\.\/components\/room'/);
  assert.match(sectionsSource, /HairlineIndex/);
  assert.doesNotMatch(sectionsSource, /ds-books-edition/);
});

test('no link on the catalogue page points at /history or another redirect endpoint', () => {
  for (const source of [pageSource, sectionsSource]) {
    assert.doesNotMatch(source, /href=["'`]\/history/);
    assert.doesNotMatch(source, /href=["'`]\/explore/);
    assert.doesNotMatch(source, /href=["'`]\/locate/);
    assert.doesNotMatch(source, /href=["'`]\/search["'`]/);
    assert.doesNotMatch(source, /href=["'`]\/map["'`]/);
  }
});

test('the unavailable-snapshot notice and the no-results empty state carry different copy', () => {
  assert.match(pageSource, /Notice/);
  assert.match(pageSource, /snapshot is unavailable/);
  assert.doesNotMatch(pageSource, /No titles matched/);
  // The narrowed-to-nothing copy lives in BooksBrowseSections/books-copy, not in the page's
  // unavailable branch, so the two states cannot share a string by accident.
  assert.match(sectionsSource, /BOOKS_CATALOG\.emptyTitle/);
});

test('books-edition.css and books-panel-chrome.ts are gone', () => {
  assert.doesNotMatch(pageSource, /books-edition\.css/);
  assert.doesNotMatch(pageSource, /books-panel-chrome/);
  assert.doesNotMatch(sectionsSource, /books-edition\.css/);
  assert.doesNotMatch(sectionsSource, /books-panel-chrome/);
});
