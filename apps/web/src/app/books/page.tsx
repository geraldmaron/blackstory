/**
 * Banned-books catalog at `/books`: a reading room with a how-to-read chapter, a searchable
 * catalog, and named handoffs. The list is national. It does not invent a join to a place.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { Notice } from '@repo/ui';
import { bannedBookToSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { buildBooksBrowseViewModel, type RawBooksBrowseParams } from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';
import { booksCatalogPulseMeta } from './BooksCatalogPulse';
import { BOOKS_INDEX_LEDE, BOOKS_PAGE_DESCRIPTION } from './books-copy';
import { DocumentColophon, ReadingEntry, Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
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

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const snapshot = await loadBannedBooksListing();

  if (snapshot.books.length === 0) {
    return (
      <Room>
        <ReadingEntry pathname="/books" title="Banned books" showCrumb={false} />
        <Notice tone="warning" title="The catalog snapshot is unavailable">
          The challenged-books catalog did not load. Nothing documented here is lost. Check back
          shortly, or read the <Link href="/methodology">methodology</Link> for how this catalog is
          built.
        </Notice>
        <WalkOffRamp>This list is national. It does not invent a join to a place.</WalkOffRamp>
      </Room>
    );
  }

  const view = buildBooksBrowseViewModel(snapshot, params);
  const suggestCorpus = snapshot.books.map(bannedBookToSuggestCorpusItem);

  return (
    <Room>
      <ReadingEntry
        pathname="/books"
        title="Banned books"
        lede={BOOKS_INDEX_LEDE}
        showCrumb={false}
      />
      <DocumentColophon facts={booksCatalogPulseMeta(snapshot)} />

      <BooksBrowseSections view={view} suggestCorpus={suggestCorpus} snapshot={snapshot} />

      <WalkOffRamp>This list is national. It does not invent a join to a place.</WalkOffRamp>
    </Room>
  );
}
