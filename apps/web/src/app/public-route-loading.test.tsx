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
import BooksLoading from './books/(index)/loading';
import LawLoading from './law/(index)/loading';
import StoriesLoading from './stories/loading';
import StoryLoading from './stories/[slug]/loading';
import MosaicCreditsLoading from './stories/mosaic-credits/loading';
import RecordsLoading from './records/loading';
import DataLoading from './data/loading';
import LivesLoading from './lives/loading';
import ReceiptLoading from './corrections/status/[receiptCode]/loading';

void React;

const here = dirname(fileURLToPath(import.meta.url));

const LOADING_BOUNDARIES = [
  {
    route: '/books',
    dir: 'books/(index)',
    Loading: BooksLoading,
    label: 'Taking the books off the shelf…',
  },
  {
    route: '/law',
    dir: 'law/(index)',
    Loading: LawLoading,
    label: 'Pulling the laws together…',
  },
  { route: '/stories', dir: 'stories', Loading: StoriesLoading, label: 'Loading stories' },
  {
    route: '/stories/[slug]',
    dir: 'stories/[slug]',
    Loading: StoryLoading,
    label: 'Loading the story',
  },
  {
    route: '/stories/mosaic-credits',
    dir: 'stories/mosaic-credits',
    Loading: MosaicCreditsLoading,
    label: 'Gathering the image credits…',
  },
  {
    route: '/records',
    dir: 'records',
    Loading: RecordsLoading,
    label: 'Pulling the records together…',
  },
  { route: '/data', dir: 'data', Loading: DataLoading, label: 'Gathering the figures…' },
  // Also the wait for /lives/explorer, which awaits the same snapshot read.
  { route: '/lives', dir: 'lives', Loading: LivesLoading, label: 'Finding the lives…' },
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

/*
 * A record page is the archive's citable document: it must read without script. A segment
 * loading boundary streams the page into a hidden block that only script reveals, so no record
 * route has one, and no ancestor segment may either (a `law/loading.tsx` would wrap
 * `law/[slug]`; the index pages keep theirs inside an `(index)` route group). It also lets a
 * missing record answer a real 404.
 */
test('no record route sits behind a loading boundary', () => {
  for (const dir of [
    'entity/[id]',
    'entity',
    'place/[slug]',
    'place',
    'invention/[slug]',
    'invention',
    'law/[slug]',
    'law',
    'books/[slug]',
    'books',
    '',
  ]) {
    assert.ok(!existsSync(join(here, dir, 'loading.tsx')), `${dir || 'app'} has a loading.tsx`);
  }
});

test('only the routes that await no read are left without a segment loading boundary', () => {
  // Static or in-memory reading rooms: no awaited data, so there is no wait to represent.
  for (const dir of ['errata', 'memorial', 'rooms', 'sources']) {
    assert.ok(!existsSync(join(here, dir, 'loading.tsx')), `${dir} unexpectedly has loading.tsx`);
  }
});
