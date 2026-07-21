/**
 * Challenged-books detail page — entity-record chrome: mast, at-a-glance, section spine + aside.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadBannedBooksListing } from '../../../lib/banned-books/public-source';
import {
  buildBooksDetailViewModel,
  listBooksStaticParams,
} from '../books-view-model';
import { BooksDetailSections } from '../BooksDetailSections';
import '../../../components/entity/entity-page.css';
import '../books.css';

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

  const { book, states } = view;
  const authorLine = book.authors.map((author) => author.name).join(', ');
  const isbn = book.identifiers.find((id) => id.system === 'isbn-13' || id.system === 'isbn-10');
  const bookshop = book.purchaseLinks.find((link) => link.retailer === 'bookshop');

  return (
    <main className="ds-container ds-page ds-books-page" id="main">
      <header className="ds-entity-mast ds-books-mast">
        <div className="ds-entity-mast__identity">
          <p className="ds-page__eyebrow">
            <span className="ds-entity-mast__meta">
              <span className="ds-entity-mast__meta-item">Reference</span>
              <span className="ds-entity-mast__meta-sep" aria-hidden="true">
                ·
              </span>
              <span className="ds-entity-mast__meta-item">Challenged book</span>
            </span>
          </p>
          <h1 className="ds-page__title">{book.title}</h1>
          <p className="ds-page__lede">
            {authorLine}
            {' · '}
            <span className="ds-mono">{book.publishedDate}</span>
          </p>
          {states.length > 0 ? (
            <div className="ds-entity-tags" role="group" aria-label="States on challenge lists">
              {states.map((state) => (
                <Link
                  key={state.code}
                  className="ds-entity-tag"
                  href={`/books?state=${encodeURIComponent(state.code)}`}
                  title={state.name}
                >
                  <span className="ds-visually-hidden">{state.name} </span>
                  {state.code}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <section className="ds-at-a-glance" aria-label="At a glance">
        <p className="ds-at-a-glance__title">At a glance</p>
        <dl className="ds-at-a-glance__grid">
          <div className="ds-at-a-glance__row">
            <dt>Citations</dt>
            <dd>
              <a className="ds-at-a-glance__link" href="#citations">
                {book.citations.length} source{book.citations.length === 1 ? '' : 's'}
              </a>
            </dd>
          </div>
          <div className="ds-at-a-glance__row">
            <dt>Challenge states</dt>
            <dd>
              <a className="ds-at-a-glance__link" href="#challenges">
                {states.length > 0 ? `${states.length} reported` : 'None on file'}
              </a>
            </dd>
          </div>
          {isbn ? (
            <div className="ds-at-a-glance__row">
              <dt>{isbn.system}</dt>
              <dd className="ds-mono">{isbn.value}</dd>
            </div>
          ) : null}
          {bookshop ? (
            <div className="ds-at-a-glance__row">
              <dt>Purchase</dt>
              <dd>
                <a
                  className="ds-at-a-glance__link"
                  href={bookshop.href}
                  rel="noopener noreferrer sponsored"
                  target="_blank"
                >
                  Bookshop.org
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <BooksDetailSections view={view} />
    </main>
  );
}
