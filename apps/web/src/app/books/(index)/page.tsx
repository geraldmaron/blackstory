/**
 * `/books`: the Archive's books lens. The challenged titles under the Archive's head, with the
 * state tile map as the lens's exhibit and the states by challenge count one switch away. The
 * list is national; a state is where a cited report places a challenge. Its own canonical
 * address (docs/ui/archive-url-contract.md, 10.3).
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { loadBannedBooksListing } from '../../../lib/banned-books/public-source.js';
import { PageFrame } from '../../../components/page';
import { ArchiveHead } from '../../archive/ArchiveHead';
import { Outcome } from '../../records/RecordsIndex';
import {
  bookStateName,
  buildBooksBrowseViewModel,
  type RawBooksBrowseParams,
} from '../books-view-model';
import { BooksBrowseSections } from '../BooksBrowseSections';
import { isbnsKnownWithoutCovers } from '../books-cover-availability';
import { BOOKS_PAGE_DESCRIPTION } from '../books-copy';
import '../../reading-page.css';
import '../../archive/lens.css';
import '../books.css';

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
  if (snapshot.books.length === 0) {
    return (
      <PageFrame width="wide" className="ds-books">
        <div className="ds-lens ds-books-stage">
          <div className="ds-lens__main">
            <ArchiveHead title="Banned books" view={null} lens="books" />
            <Outcome
              title="The catalog did not load"
              action={{ href: '/books', label: 'Try again' }}
            >
              The titles and their reports are kept, only this page failed to read them.
            </Outcome>
          </div>
        </div>
      </PageFrame>
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
    <PageFrame width="wide" className="ds-books">
      {/* The dek states the count in words; no numeral repeats it. */}
      <BooksBrowseSections
        view={view}
        head={<ArchiveHead title="Banned books" dek={dek(view)} view={null} lens="books" />}
      />
    </PageFrame>
  );
}
