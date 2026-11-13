/**
 * `/books`: the challenged titles as a cover wall, with the states by challenge count one
 * switch away. The list is national; a state is where a cited report places a challenge.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { DisplayNumeral, PageHeader } from '@repo/ui';
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
import { isbnsWithCovers } from './books-cover-availability';
import { BOOKS_PAGE_DESCRIPTION } from './books-copy';
import '../reading-room.css';
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
  const where =
    view.state === 'all'
      ? `across ${states} ${states === 1 ? 'state' : 'states'}`
      : `in ${bookStateName(view.state)}`;
  return `${titles} challenged in schools and libraries ${where}, cited from public reports.`;
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
        <PageHeader {...header} />
        <Outcome title="The catalog did not load" action={{ href: '/books', label: 'Try again' }}>
          The titles and their reports are kept, only this page failed to read them.
        </Outcome>
      </Room>
    );
  }

  const built = buildBooksBrowseViewModel(snapshot, params);
  // A title with no cover upstream gets no ISBN, so it renders typeset without a failing request.
  const covered = await isbnsWithCovers(built.items.map((item) => item.coverIsbn));
  const view = {
    ...built,
    items: built.items.map((item) =>
      item.coverIsbn && !covered.has(item.coverIsbn) ? { ...item, coverIsbn: undefined } : item,
    ),
  };

  return (
    <Room width="wide" className="ds-books">
      {/* The title count as a giant numeral; the dek states it in words, so it is not read twice. */}
      <PageHeader
        {...header}
        dek={dek(view)}
        {...(view.totalMatched > 0
          ? {
              actions: (
                <DisplayNumeral decorative className="ds-books-head__count">
                  {view.totalMatched.toLocaleString('en-US')}
                </DisplayNumeral>
              ),
            }
          : {})}
      />
      <BooksBrowseSections view={view} />
    </Room>
  );
}
