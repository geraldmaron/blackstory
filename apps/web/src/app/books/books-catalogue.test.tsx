/**
 * The /books catalog as rendered: ruled rows of links whose accessible name is the title, the
 * states view as a decorative tile grid beside a ranked list of links, designed empty states,
 * and the census limit on the page.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import { BooksCoverArt } from './BooksCoverArt';
import { BooksBrowseSections, bandBooks, tileLegend, tileStep } from './BooksBrowseSections';
import { buildBooksBrowseViewModel } from './books-view-model';

void React;

const SNAPSHOT = getBannedBooksListingSnapshot();
const render = (params: Parameters<typeof buildBooksBrowseViewModel>[1]) =>
  renderToStaticMarkup(<BooksBrowseSections view={buildBooksBrowseViewModel(SNAPSHOT, params)} />);

test('a decorative cover is hidden from assistive tech and carries no competing name', () => {
  const html = renderToStaticMarkup(
    <BooksCoverArt title="The Bluest Eye" isbn="9780307278449" size="S" />,
  );
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /alt=""/);
});

test('with no ISBN the cover is typeset with the title and author, never initials', () => {
  const html = renderToStaticMarkup(<BooksCoverArt title="Beloved" author="Toni Morrison" />);
  assert.match(html, /ds-book-cover--typeset/);
  assert.match(html, /<span class="ds-book-cover__title">Beloved<\/span>/);
  assert.match(html, /<span class="ds-book-cover__author">Toni Morrison<\/span>/);
  assert.doesNotMatch(html, />BE</);
});

test('every title is one ruled row; the count is a numeral and a word, with no text over a cover', () => {
  const html = render({});
  const rows = html.match(/class="ds-books-row"/g) ?? [];
  assert.equal(rows.length, SNAPSHOT.books.length);
  assert.match(html, /href="\/books\/the-bluest-eye"/);
  assert.match(html, /Challenged in <\/span><span class="ds-books-row__n">\d+<\/span>/);
  assert.doesNotMatch(html, /ds-books-wall|ds-book-cover--typeset|Page \d+ of/);
});

test('bands pack whole groups to about two screens and never split a group', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {});
  const bands = bandBooks(view.items, 'title');
  assert.equal(
    bands.flat().reduce((sum, group) => sum + group.items.length, 0),
    view.items.length,
  );
  for (const band of bands) {
    const rows = band.reduce((sum, group) => sum + group.items.length, 0);
    assert.ok(rows <= 18 || band.length === 1);
  }
  const labels = bands.flat().map((group) => group.label);
  assert.equal(new Set(labels).size, labels.length);
});

test('a bare cover with no ISBN renders nothing, never a typeset stand-in', () => {
  assert.equal(renderToStaticMarkup(<BooksCoverArt bare title="Beloved" />), '');
});

test('the toolbar carries State, Author, Sort and Covers | States, all as links', () => {
  const html = render({});
  for (const key of ['state', 'author', 'sort']) {
    assert.match(html, new RegExp(`id="records-menu-${key}"`));
  }
  assert.match(html, /aria-label="Show books as"/);
  assert.match(html, /href="\/books\?view=states"/);
  assert.doesNotMatch(html, /<form|<input|<select/);
});

test('the states view: a decorative tile grid and a ranked list that filters the wall', () => {
  const html = render({ view: 'states' });
  assert.match(html, /<div class="ds-books-map" aria-hidden="true"><div class="ds-books-tiles">/);
  assert.match(html, /<ul class="ds-books-legend">/);
  assert.match(html, /<ol class="ds-books-ranks" aria-label="States by challenged titles">/);
  assert.match(html, /href="\/books\?state=FL"/);
  // Order means nothing on a figure, so the Sort control is not offered there.
  assert.doesNotMatch(html, /records-menu-sort/);
  // A tile is a code and a shade step; the counts are printed once, in the ranked list.
  assert.match(html, /class="ds-books-tiles__tile" data-step="4"[^>]*>FL<\/span>/);
  assert.doesNotMatch(html, /ds-books-tiles__count/);
});

test('the tile legend reads its ranges off the step formula, with no gaps or overlaps', () => {
  assert.deepEqual(tileLegend(62), [
    { step: 1, from: 1, to: 3 },
    { step: 2, from: 4, to: 15 },
    { step: 3, from: 16, to: 34 },
    { step: 4, from: 35, to: 62 },
  ]);
  assert.equal(tileStep(0, 62), 0);
  assert.deepEqual(tileLegend(1), [{ step: 4, from: 1, to: 1 }]);
});

test('the titles view leads with the busiest state on sand, every entry opening the states view', () => {
  const view = buildBooksBrowseViewModel(SNAPSHOT, {});
  const html = render({});
  const [top] = view.stateCounts;
  assert.ok(top);
  assert.match(html, /class="ds-books-lead/);
  assert.match(html, new RegExp(`>${top.count}</span>`));
  assert.match(html, new RegExp(`class="ds-books-lead__state">${top.name}<`));
  assert.equal(
    (html.match(/class="ds-books-lead__row" href="\/books\?view=states"/g) ?? []).length,
    Math.min(4, view.stateCounts.length - 1),
  );
});

test('a state or author no title carries is dropped, not echoed back', () => {
  const html = render({ state: 'zz', author: 'Nobody At All' });
  assert.doesNotMatch(html, /aria-label="Active filters"/);
  assert.doesNotMatch(html, /No titles match/);
});

test('the filtered state is echoed as a removable chip and marked in the states list', () => {
  const html = render({ state: 'FL', view: 'states' });
  assert.match(html, /aria-label="Active filters"/);
  assert.match(html, /class="ds-books-ranks__row" href="\/books\?state=FL" aria-current="true"/);
  assert.match(html, /data-current="true"/);
});

test('no match is a designed outcome that names what was asked and clears it', () => {
  const html = render({ q: 'zzzz-not-a-book' });
  assert.match(html, /No titles match/);
  assert.match(html, /Nothing in the catalog matches “zzzz-not-a-book”/);
  assert.match(html, /href="\/books"/);
  const states = render({ q: 'zzzz-not-a-book', view: 'states' });
  assert.match(states, /No states to show/);
});

test('the census limit and what a state means are on the page as visible text', () => {
  const html = render({});
  assert.match(html, /not a complete national census/);
  assert.match(html, /not a claim that the book left every school in that state/);
  assert.match(html, /href="\/methodology"/);
});
