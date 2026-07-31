/**
 * Public challenged-books browse surface at `/books`. v9 room kit edition with
 * shared browse/filter surface. Preserves banned-books catalog pulse, rip rows, and browse
 * URL params (`q`, `state`, `author`, `sort`, `dir`, `page`).
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { bannedBookToSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { buildBooksBrowseViewModel, type RawBooksBrowseParams } from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';
import { BooksCatalogPulse } from './BooksCatalogPulse';
import { BOOKS_INTRO, BOOKS_PAGE_DESCRIPTION } from './books-copy';
import { OffRamp, Prose, Room, RoomHeader } from '../../components/room';
import '../reading-room.css';
import './books-edition.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/books',
  title: 'Banned books',
  description: BOOKS_PAGE_DESCRIPTION,
});

type BooksPageProps = {
  readonly searchParams: Promise<RawBooksBrowseParams>;
};

export default async function BooksBrowsePage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const snapshot = await loadBannedBooksListing();
  const view = buildBooksBrowseViewModel(snapshot, params);
  const suggestCorpus = snapshot.books.map(bannedBookToSuggestCorpusItem);

  return (
    <Room>
      <RoomHeader
        pathname="/books"
        kicker={BOOKS_INTRO.kicker}
        title={
          <>
            Banned <em>{BOOKS_INTRO.titleWarm}</em>.
          </>
        }
        lede={BOOKS_INTRO.lede}
      />

      <BooksCatalogPulse snapshot={snapshot} />

      <Prose>
        <p>
          {/* `sources` is the record index's family for publications, laws and artifacts;
              there is no publication-only facet, so the label names the family honestly
              rather than promising a narrowing the index cannot make. */}
          <Link className="ds-cta-link" href="/records?kind=sources">
            Also find publications in the record index
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/chapters">
            Chapters
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
        </p>
        <p>
          Archive texture · symbolic atmosphere.{' '}
          <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
        </p>
      </Prose>

      <BooksBrowseSections view={view} suggestCorpus={suggestCorpus} />

      <OffRamp
        title={
          <>
            Or go straight to the <em>records</em>
          </>
        }
        actions={[
          { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
          { label: 'Search the archive', href: '/records' },
        ]}
      >
        Press <kbd className="ds-kbd">⌘</kbd>
        <kbd className="ds-kbd">K</kbd> to search books and records from anywhere.
      </OffRamp>
    </Room>
  );
}
