/**
 * Every public route that awaits a catalog or story read has its own route-segment loading
 * boundary, and each one is the shared source-neutral wait: one polite announcement, hidden
 * placeholders, and no invented counts. A route that is added to this list without a
 * `loading.tsx` fails here instead of falling back to the parent segment's wait.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BooksLoading from './books/loading';
import BookLoading from './books/[slug]/loading';
import LawLoading from './law/loading';
import LawEntryLoading from './law/[slug]/loading';
import StoriesLoading from './stories/loading';
import StoryLoading from './stories/[slug]/loading';
import MosaicCreditsLoading from './stories/mosaic-credits/loading';
import RecordsLoading from './records/loading';
import PlaceLoading from './place/[slug]/loading';
import InventionLoading from './invention/[slug]/loading';
import DataLoading from './data/loading';
import LivesLoading from './lives/loading';
import ReceiptLoading from './corrections/status/[receiptCode]/loading';

void React;

const here = dirname(fileURLToPath(import.meta.url));

const LOADING_BOUNDARIES = [
  { route: '/books', dir: 'books', Loading: BooksLoading, label: 'Opening books…' },
  { route: '/books/[slug]', dir: 'books/[slug]', Loading: BookLoading, label: 'Opening book entry…' },
  { route: '/law', dir: 'law', Loading: LawLoading, label: 'Opening law entries…' },
  {
    route: '/law/[slug]',
    dir: 'law/[slug]',
    Loading: LawEntryLoading,
    label: 'Opening law entry…',
  },
  { route: '/stories', dir: 'stories', Loading: StoriesLoading, label: 'Opening stories…' },
  { route: '/stories/[slug]', dir: 'stories/[slug]', Loading: StoryLoading, label: 'Opening story…' },
  {
    route: '/stories/mosaic-credits',
    dir: 'stories/mosaic-credits',
    Loading: MosaicCreditsLoading,
    label: 'Opening image credits…',
  },
  { route: '/records', dir: 'records', Loading: RecordsLoading, label: 'Opening records…' },
  // Place and invention render the shared record room, so they reuse the record skeleton.
  { route: '/place/[slug]', dir: 'place/[slug]', Loading: PlaceLoading, label: 'Opening record' },
  {
    route: '/invention/[slug]',
    dir: 'invention/[slug]',
    Loading: InventionLoading,
    label: 'Opening record',
  },
  { route: '/data', dir: 'data', Loading: DataLoading, label: 'Opening data…' },
  // Also the wait for /lives/explorer, which awaits the same snapshot read.
  { route: '/lives', dir: 'lives', Loading: LivesLoading, label: 'Opening lives…' },
  {
    route: '/corrections/status/[receiptCode]',
    dir: 'corrections/status/[receiptCode]',
    Loading: ReceiptLoading,
    label: 'Looking up your receipt…',
  },
] as const;

for (const { route, dir, Loading, label } of LOADING_BOUNDARIES) {
  test(`${route} has its own loading boundary that announces once and hides the placeholder`, () => {
    assert.ok(existsSync(join(here, dir, 'loading.tsx')), `${route} has no loading.tsx`);
    const html = renderToStaticMarkup(<Loading />);
    assert.equal((html.match(/role="status"/g) ?? []).length, 1);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /aria-hidden="true"/);
    assert.ok(html.includes(label), `${route} should announce "${label}"`);
    assert.doesNotMatch(html, /\d[\d,]* (records|books|stories|law entries|credits)/);
    assert.doesNotMatch(html, /role="progressbar"/);
  });
}

test('only the routes that await no read are left without a segment loading boundary', () => {
  // Static or in-memory reading rooms: no awaited data, so there is no wait to represent.
  for (const dir of ['errata', 'memorial', 'rooms', 'sources']) {
    assert.ok(!existsSync(join(here, dir, 'loading.tsx')), `${dir} unexpectedly has loading.tsx`);
  }
});
