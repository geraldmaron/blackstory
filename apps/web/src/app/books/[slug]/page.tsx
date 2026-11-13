/**
 * A challenged book at `/books/{slug}`, on the shared record anatomy (`BookRecordView`).
 */
import { notFound } from 'next/navigation';
import { resolvePublicEntityView } from '../../../lib/public-data/source';
import { buildExploreMapSource } from '../../../lib/map-experience/build-explore-map-source';
import { exploreRecordHref } from '../../../lib/map-experience/url-state';
import { loadBannedBooksListing } from '../../../lib/banned-books/public-source';
import {
  buildBooksDetailViewModel,
  buildBooksRelatedItems,
  listBooksStaticParams,
} from '../books-view-model';
import { coverIsbnForBook } from '../books-cover';
import { isbnsKnownWithoutCovers } from '../books-cover-availability';
import { BookRecordView, type BookArchiveRecord } from './BookRecordView';

type BooksDetailPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateStaticParams() {
  const snapshot = await loadBannedBooksListing();
  return [...listBooksStaticParams(snapshot)];
}

export async function generateMetadata({ params }: BooksDetailPageProps) {
  const { slug } = await params;
  const snapshot = await loadBannedBooksListing();
  const view = buildBooksDetailViewModel(snapshot, slug);
  if (view.kind !== 'ok') {
    return { title: 'Book entry not found' };
  }
  return {
    title: view.book.title,
    description: view.book.description,
  };
}

async function resolveArchiveRecord(entityId: string): Promise<BookArchiveRecord | undefined> {
  const entity = (await resolvePublicEntityView(entityId)).data;
  if (!entity) return undefined;
  const pinned = buildExploreMapSource([entity]).featureCollection.features.length > 0;
  return {
    href: `/entity/${entity.id}`,
    name: entity.displayName,
    ...(pinned ? { mapHref: exploreRecordHref(entity.id) } : {}),
  };
}

export default async function BooksDetailPage({ params }: BooksDetailPageProps) {
  const { slug } = await params;
  const snapshot = await loadBannedBooksListing();
  const view = buildBooksDetailViewModel(snapshot, slug);
  if (view.kind !== 'ok') {
    notFound();
  }
  const archiveRecord = view.book.canonicalEntityId
    ? await resolveArchiveRecord(view.book.canonicalEntityId)
    : undefined;
  const isbn = coverIsbnForBook(view.book);
  const hasCover = isbn ? !isbnsKnownWithoutCovers([isbn], 'L').has(isbn) : false;
  return (
    <BookRecordView
      view={view}
      related={buildBooksRelatedItems(snapshot, view.book)}
      hasCover={hasCover}
      {...(archiveRecord ? { archiveRecord } : {})}
    />
  );
}
