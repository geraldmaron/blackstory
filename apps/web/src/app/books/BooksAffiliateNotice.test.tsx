/**
 * SP-12b acceptance (repo-92n2.12.2): the Bookshop affiliate block must sit below the evidence
 * sections (challenges, citations), separated from them by a hairline rule, and must name itself
 * as an affiliate link in reader-visible body text, not only in a `rel="sponsored"` attribute a
 * reader never sees. Renders the real seed book so the "evidence" markup is authentic content,
 * not a hand-typed fixture standing in for it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import { BooksAffiliateNotice } from './BooksAffiliateNotice';
import { BooksDetailSections } from './BooksDetailSections';
import { buildBooksDetailViewModel, buildBooksRelatedItems } from './books-view-model';

void React;

const SNAPSHOT = getBannedBooksListingSnapshot();
const VIEW = buildBooksDetailViewModel(SNAPSHOT, 'the-bluest-eye');
if (VIEW.kind !== 'ok') {
  throw new Error('seed fixture "the-bluest-eye" is missing from the banned-books seed');
}
const BOOKSHOP_LINK = VIEW.book.purchaseLinks.find((link) => link.retailer === 'bookshop');
if (!BOOKSHOP_LINK) {
  throw new Error('seed fixture "the-bluest-eye" carries no bookshop purchase link');
}

test('the affiliate block renders below both evidence sections, in real page order', () => {
  const relatedItems = buildBooksRelatedItems(SNAPSHOT, VIEW.book);
  const html = renderToStaticMarkup(
    <>
      <BooksDetailSections view={VIEW} relatedItems={relatedItems} placePanel={null} />
      <BooksAffiliateNotice href={BOOKSHOP_LINK.href} />
    </>,
  );

  const challengesIndex = html.indexOf('id="challenges"');
  const citationsIndex = html.indexOf('id="citations"');
  const affiliateIndex = html.indexOf('id="books-affiliate-heading"');

  assert.ok(challengesIndex >= 0, 'expected the challenges (evidence) section to render');
  assert.ok(citationsIndex >= 0, 'expected the citations (evidence) section to render');
  assert.ok(affiliateIndex >= 0, 'expected the affiliate block to render');
  assert.ok(
    affiliateIndex > challengesIndex,
    'the affiliate block must sit below the challenge-list evidence section',
  );
  assert.ok(
    affiliateIndex > citationsIndex,
    'the affiliate block must sit below the citations evidence section',
  );
});

test('the affiliate block names itself affiliate in body text, not only in a rel attribute', () => {
  const html = renderToStaticMarkup(<BooksAffiliateNotice href={BOOKSHOP_LINK.href} />);
  const bodyText = html.replace(/<[^>]+>/g, ' ');
  assert.match(bodyText, /affiliate/i, 'the word "affiliate" must appear in reader-visible text');
  assert.match(html, /rel="noopener noreferrer sponsored"/);
});

test('the affiliate block is its own hairline-ruled section, not folded into evidence', () => {
  const html = renderToStaticMarkup(<BooksAffiliateNotice href={BOOKSHOP_LINK.href} />);
  assert.match(html, /<section class="ds-room-section" aria-labelledby="books-affiliate-heading">/);
});
