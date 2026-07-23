/**
 * Public challenged-books browse surface at `/books`. v6 edition Surface stack with
 * shared gutter mosaic atmosphere, catalog pulse, rip rows, and preserved browse URL params.
 */
import Link from 'next/link';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { EditionAtmosphereMosaic } from '../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import { bannedBookToSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { loadBannedBooksListing } from '../../lib/banned-books/public-source.js';
import { buildBooksBrowseViewModel, type RawBooksBrowseParams } from './books-view-model';
import { BooksBrowseSections } from './BooksBrowseSections';
import { BooksCatalogPulse } from './BooksCatalogPulse';
import { BOOKS_INTRO, BOOKS_PAGE_DESCRIPTION } from './books-copy';
import {
  BOOKS_EDITION_MOSAIC_SEED,
  booksEditionPanelClassName,
  booksEditionRootClassName,
  booksEditionStackClassName,
} from './books-panel-chrome';
import './books-edition.css';

export const metadata = {
  title: 'Banned books',
  description: BOOKS_PAGE_DESCRIPTION,
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
    <div className={booksEditionRootClassName()} data-books-edition="v6">
      <EditionAtmosphereMosaic seedKey={BOOKS_EDITION_MOSAIC_SEED} count={16} />
      <main className="ds-container ds-page" id="main">
        <div className={booksEditionStackClassName()}>
          <article className={booksEditionPanelClassName('intro')}>
            <header className="ds-books-edition__header">
              <span className="ds-books-edition__index" aria-hidden="true">
                00
              </span>
              <div>
                <p className="ds-books-edition__kicker">{BOOKS_INTRO.kicker}</p>
                <h1 className="ds-books-edition__title">
                  Banned <em>{BOOKS_INTRO.titleWarm}</em>.
                </h1>
                <p className="ds-books-edition__lede">{BOOKS_INTRO.lede}</p>
                <BooksCatalogPulse snapshot={snapshot} />
                <p className="ds-books-edition__crosslink">
                  <Link className="ds-cta-link" href="/history?kind=publication">
                    Also find publications in History
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
                <p className="ds-books-edition__credit">
                  Archive mosaic · symbolic atmosphere · decorative gutter tiles only.{' '}
                  <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
                </p>
              </div>
            </header>
          </article>

          <BooksBrowseSections view={view} suggestCorpus={suggestCorpus} />
        </div>
      </main>
    </div>
  );
}
