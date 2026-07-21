/**
 * Challenged-books detail page at `/books/{slug}` with citations, challenges, and purchase links.
 */
import { notFound } from 'next/navigation';
import { loadBannedBooksListing } from '../../../lib/banned-books/public-source';
import {
  buildBooksDetailViewModel,
  listBooksStaticParams,
} from '../books-view-model';
import { BooksDetailSections } from '../BooksDetailSections';

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

export default async function BooksDetailPage({ params }: BooksDetailPageProps) {
  const { slug } = await params;
  const snapshot = await loadBannedBooksListing();
  const view = buildBooksDetailViewModel(snapshot, slug);
  if (view.kind !== 'ok') {
    notFound();
  }

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Reference</p>
      <h1 className="ds-page__title">{view.book.title}</h1>
      <p className="ds-page__lede">
        {view.book.authors.map((author) => author.name).join(', ')}
        {' · '}
        <span className="ds-mono">{view.book.publishedDate}</span>
      </p>
      <BooksDetailSections view={view} />
    </main>
  );
}
