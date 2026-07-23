/**
 * Public challenged-books browse surface at `/books`. Compact index chrome aligned with
 * Stories / entity density — not a sparse reference wireframe.
 */
import Link from 'next/link';
import { bannedBookToSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { buildBooksBrowseViewModel, type RawBooksBrowseParams } from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';

export const metadata = {
  title: 'Banned books',
  description:
    'Challenged and restricted titles relevant to Black history, with reported school and library challenges cited from public sources. Not a complete national census.',
};

type BooksPageProps = {
  readonly searchParams: Promise<RawBooksBrowseParams>;
};

export default async function BooksBrowsePage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const snapshot = await loadBannedBooksListing();
  const view = buildBooksBrowseViewModel(snapshot, params);
  const suggestCorpus = snapshot.books.map(bannedBookToSuggestCorpusItem);

  return (
    <main className="ds-container ds-page ds-books-page" id="main">
      <p className="ds-page__eyebrow">Reference</p>
      <h1 className="ds-page__title">Banned books</h1>
      <p className="ds-page__lede">
        Challenged and restricted titles tied to Black history and related reading — each with
        cited challenge reports and a path to buy or look up the book. Not a complete national
        census; status can change. Sources include ALA challenged-book lists and PEN America
        reports cited on each record.
      </p>
      <p className="ds-books-page__crosslink">
        <Link className="ds-cta-link" href="/search?kind=publication">
          Also find publications in Search
        </Link>
        {' · '}
        <Link className="ds-cta-link" href="/stories">
          Stories
        </Link>
        {' · '}
        <Link className="ds-cta-link" href="/methodology">
          Methodology
        </Link>
      </p>
      <BooksBrowseSections view={view} suggestCorpus={suggestCorpus} />
    </main>
  );
}
