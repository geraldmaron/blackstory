/**
 * Public banned-books catalogue index at `/books`. v9 room kit reading room: records
 * documented removal requests against titles, not a ranked or curated "controversial books"
 * list. Preserves the browse URL contract (`q`, `state`, `author`, `sort`, `dir`, `page`).
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Notice } from '@repo/ui';
import { bannedBookReportedStates } from '@repo/domain';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { bannedBookToSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import {
  buildBooksBrowseViewModel,
  stateLabel,
  type RawBooksBrowseParams,
} from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';
import { booksCatalogPulseMeta } from './BooksCatalogPulse';
import { BOOKS_PAGE_DESCRIPTION } from './books-copy';
import { OffRamp, Prose, RailGroup, Room, RoomHeader } from '../../components/room';
import '../reading-room.css';

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

  // A snapshot carrying no books at all is a data-availability fault, not a search that came
  // back empty. The two must read differently: this names the fault and points at the
  // methodology; `HairlineIndex`'s own empty state (rendered below, when the snapshot is fine
  // but a facet or search term narrows to nothing) names the active facets and offers /submit.
  if (snapshot.books.length === 0) {
    return (
      <Room>
        <RoomHeader pathname="/books" kicker="CATALOGUE" title="Banned books" showPath={false} />
        <Notice tone="warning" title="The catalog snapshot is unavailable">
          We could not load the challenged-books catalog just now. Nothing documented here is lost;
          this is a fault on our side. Please check back shortly, or read the{' '}
          <Link href="/methodology">methodology</Link> for how this catalog is built.
        </Notice>
      </Room>
    );
  }

  const view = buildBooksBrowseViewModel(snapshot, params);
  const suggestCorpus = snapshot.books.map(bannedBookToSuggestCorpusItem);

  const stateCounts = new Map<string, number>();
  for (const book of snapshot.books) {
    for (const code of bannedBookReportedStates(book)) {
      stateCounts.set(code, (stateCounts.get(code) ?? 0) + 1);
    }
  }
  const rail = (
    <RailGroup
      title="Where books are challenged"
      entries={[...stateCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([code, count]) => ({
          label: stateLabel(code),
          href: `/?state=${encodeURIComponent(code)}`,
          count,
        }))}
      limit={12}
    />
  );

  return (
    <Room rail={rail}>
      <RoomHeader
        pathname="/books"
        kicker="CATALOGUE"
        title="Banned books"
        lede="This records documented removal requests against titles in schools and libraries, cited from public reports. It is not a list of controversial books, and it is not a complete national census."
        meta={booksCatalogPulseMeta(snapshot)}
      />

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

      <BooksBrowseSections view={view} suggestCorpus={suggestCorpus} snapshot={snapshot} />

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
