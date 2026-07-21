/**
 * Public challenged-books browse surface at `/books`.
 */
import Link from 'next/link';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source';
import { buildBooksBrowseViewModel, type RawBooksBrowseParams } from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';

export const metadata = {
  title: 'Books',
  description:
    'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources.',
};

const BOOKS_BROWSE_LEDE =
  'Challenged & restricted books — a curated reference to titles with reported school or library restrictions, each linked to public challenge records and independent citations. Status may change; this is not a complete national census.';

type BooksPageProps = {
  readonly searchParams: Promise<RawBooksBrowseParams>;
};

export default async function BooksBrowsePage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const snapshot = await loadBannedBooksListing();
  const view = buildBooksBrowseViewModel(snapshot, params);

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Reference</p>
      <h1 className="ds-page__title">Books</h1>
      <p className="ds-page__lede">{BOOKS_BROWSE_LEDE}</p>
      <p className="ds-page__lede">
        <Link href="/search?kind=publication">Also find publications in Search</Link>
      </p>
      <BooksBrowseSections view={view} />
    </main>
  );
}
