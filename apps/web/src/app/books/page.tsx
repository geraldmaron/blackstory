/**
 * `/books`: the challenged titles as a cover wall, with the states by challenge count one
 * switch away. The list is national; a state is where a cited report places a challenge.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { PageHeader } from '@repo/ui';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { parentCrumb, Room } from '../../components/room';
import { Outcome } from '../records/RecordsIndex';
import {
  bookStateName,
  buildBooksBrowseViewModel,
  type RawBooksBrowseParams,
} from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';
import { isbnsKnownWithoutCovers } from './books-cover-availability';
import { BOOKS_PAGE_DESCRIPTION } from './books-copy';
import '../reading-room.css';
import '../parked.css';
import './books.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/books',
  title: 'Banned books',
  description: BOOKS_PAGE_DESCRIPTION,
});

type BooksPageProps = {
  readonly searchParams: Promise<RawBooksBrowseParams>;
};

function dek(view: ReturnType<typeof buildBooksBrowseViewModel>): string {
  const states = view.stateCounts.length;
  const titles =
    view.totalMatched === view.totalAvailable
      ? `${view.totalAvailable.toLocaleString('en-US')} titles`
      : `${view.totalMatched.toLocaleString('en-US')} of ${view.totalAvailable.toLocaleString('en-US')} titles`;
  // Nothing matched: there is no state to count, so the sentence does not name any.
  const where =
    view.state !== 'all'
      ? ` in ${bookStateName(view.state)}`
      : states > 0
        ? ` across ${states} ${states === 1 ? 'state' : 'states'}`
        : '';
  return `${titles} challenged in schools and libraries${where}, cited from public reports.`;
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const snapshot = await loadBannedBooksListing();
  const header = {
    crumb: parentCrumb('/books'),
    linkAs: Link,
    title: 'Banned books',
    display: true,
    className: 'ds-books-head',
  } as const;

  if (snapshot.books.length === 0) {
    return (
      <Room width="wide" className="ds-books">
        <div className="ds-parked ds-books-stage" data-ground="ink" data-ground-fixed="">
          <div className="ds-parked__main">
            <PageHeader {...header} />
            <Outcome
              ground="paper"
              title="The catalog did not load"
              action={{ href: '/books', label: 'Try again' }}
            >
              The titles and their reports are kept, only this page failed to read them.
            </Outcome>
          </div>
        </div>
      </Room>
    );
  }

  const built = buildBooksBrowseViewModel(snapshot, params);
  // A title known to have no cover upstream gets no ISBN, so it renders typeset without a failing
  // request. Unchecked titles render as usual and are checked in the background.
  const uncovered = isbnsKnownWithoutCovers(
    built.items.map((item) => item.coverIsbn),
    'L',
  );
  const view = {
    ...built,
    items: built.items.map((item) =>
      item.coverIsbn && uncovered.has(item.coverIsbn) ? { ...item, coverIsbn: undefined } : item,
    ),
  };

  return (
    <Room width="wide" className="ds-books">
      {/* The dek states the count in words; no numeral repeats it. */}
      <BooksBrowseSections view={view} head={<PageHeader {...header} dek={dek(view)} />} />
    </Room>
  );
}
