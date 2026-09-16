/**
 * Banned-books catalog browse tools at `/books/browse`. The how-it-works Banned books section is
 * the default visitor journey; this route keeps search, facets, and the full index.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { Notice } from '@repo/ui';
import { bannedBookReportedStates } from '@repo/domain';
import { bannedBookToSuggestCorpusItem } from '../../../lib/banned-books/suggest-books.js';
import { loadBannedBooksListing } from '../../../lib/banned-books/public-source.js';
import {
  buildBooksBrowseHref,
  buildBooksBrowseViewModel,
  stateLabel,
  type RawBooksBrowseParams,
} from '../books-view-model';
import { BooksBrowseSections } from '../BooksBrowseSections';
import { booksCatalogPulseMeta } from '../BooksCatalogPulse';
import { BOOKS_PAGE_DESCRIPTION } from '../books-copy';
import {
  OrientationInstrument,
  ReadingEntry,
  DocumentColophon,
  Room,
} from '../../../components/room';
import { WalkOffRamp } from '../../walk-off-ramp';
import '../../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/books/browse',
  title: 'Browse banned books',
  description: BOOKS_PAGE_DESCRIPTION,
});

type BooksBrowsePageProps = {
  readonly searchParams: Promise<RawBooksBrowseParams>;
};

export default async function BooksBrowsePage({ searchParams }: BooksBrowsePageProps) {
  const params = await searchParams;
  const snapshot = await loadBannedBooksListing();

  if (snapshot.books.length === 0) {
    return (
      <Room>
        <ReadingEntry pathname="/books/browse" title="Banned books" showCrumb={false} />
        <Notice tone="warning" title="The catalog snapshot is unavailable">
          We could not load the challenged-books catalog just now. Nothing documented here is lost;
          this is a fault on our side. Please check back shortly, or read the{' '}
          <Link href="/how-it-works?s=methodology">methodology</Link> for how this catalog is built.
        </Notice>
        <WalkOffRamp>This list is national. It does not invent a join to a place.</WalkOffRamp>
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
  const topStates = [...stateCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([code, count]) => ({
      label: stateLabel(code),
      href: buildBooksBrowseHref({
        q: view.q,
        state: code,
        author: view.author,
        sort: view.sort,
        dir: view.dir,
      }),
      note: `${count.toLocaleString('en-US')} titles`,
    }));

  const rail = (
    <OrientationInstrument
      where="Challenged titles, cited from public reports"
      moves={[
        ...topStates,
        { label: 'How this catalog is built', href: '/how-it-works?s=methodology' },
      ].slice(0, 3)}
    />
  );

  return (
    <Room rail={rail}>
      <ReadingEntry
        pathname="/books/browse"
        title="Banned books"
        lede="This records documented removal requests against titles in schools and libraries, cited from public reports. It is not a list of controversial books, and it is not a complete national census."
        showCrumb={false}
      />
      <DocumentColophon facts={booksCatalogPulseMeta(snapshot)} />

      <BooksBrowseSections view={view} suggestCorpus={suggestCorpus} snapshot={snapshot} />

      <WalkOffRamp>This list is national. It does not invent a join to a place.</WalkOffRamp>
    </Room>
  );
}
