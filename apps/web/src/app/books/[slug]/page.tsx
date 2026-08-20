/**
 * Challenged-books detail page: room kit shell, cover + anatomy header, primary context
 * story, challenges/evidence sections, related titles below.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { RecordAnatomyPanel } from '../../../components/patterns/RecordAnatomyPanel';
import type { RecordAnatomyFact } from '../../../components/patterns/RecordAnatomyPanel';
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
} from '../../entity/[id]/entity-anatomy-facts';
import { geoAnchorFor } from '../../../lib/map-experience/entity-geo';
import { resolvePublicEntityView } from '../../../lib/public-data/source';
import { loadBannedBooksListing } from '../../../lib/banned-books/public-source';
import {
  activeBookChallenges,
  buildBooksDetailViewModel,
  buildBooksRelatedItems,
  listBooksStaticParams,
} from '../books-view-model';
import { BooksDetailSections } from '../BooksDetailSections';
import { BooksAnatomyStrip } from '../BooksAnatomyStrip';
import { BooksCoverArt } from '../BooksCoverArt';
import { coverIsbnForBook } from '../books-cover';
import { BOOKS_DETAIL } from '../books-copy';
import { Room, RoomHeader } from '../../../components/room';
import '../../reading-room.css';
import '../../../components/patterns/record-anatomy.css';

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
  const coverIsbn = coverIsbnForBook(book);
  const bookshop = book.purchaseLinks.find((link) => link.retailer === 'bookshop');
  const activeChallenges = activeBookChallenges(book);
  const relatedItems = buildBooksRelatedItems(snapshot, book);

  let entityPlacePanel: ReactNode = null;
  if (book.canonicalEntityId) {
    const entityResult = await resolvePublicEntityView(book.canonicalEntityId);
    const entity = entityResult.data;
    if (entity) {
      const geoAnchor = entity.geoAnchor ?? geoAnchorFor(entity.id);
      const anatomyInputs = buildEntityAnatomyInputs(entity, undefined);
      const anatomyPlace = buildEntityAnatomyPlace(entity, geoAnchor);
      if (anatomyPlace) {
        const facts: RecordAnatomyFact[] = [
          {
            key: 'kind',
            label: 'Kind',
            value: anatomyInputs.kindLabel,
            icon: { variant: 'record-kind', kind: anatomyInputs.kind, muted: true },
          },
          {
            key: 'where',
            label: 'Where',
            value: anatomyInputs.whereLabel,
            icon: { variant: 'record-where' },
          },
          {
            key: 'era',
            label: 'Era',
            value: anatomyInputs.eraLabel,
            icon: { variant: 'record-era' },
          },
          {
            key: 'evidence',
            label: 'Evidence',
            value: anatomyInputs.evidenceLabel,
            icon: { variant: 'record-evidence', tier: anatomyInputs.evidenceTier },
          },
        ];
        entityPlacePanel = (
          <section className="ds-room-section" aria-labelledby="books-place-heading">
            <p className="ds-books-edition__panel-title">Place</p>
            <h2 className="ds-books-edition__panel-heading" id="books-place-heading">
              Archive record on the map
            </h2>
            <p className="ds-books-edition__footnote">
              <Link href={`/entity/${entity.id}`}>Open {entity.displayName}</Link>
            </p>
            <RecordAnatomyPanel
              facts={facts}
              place={anatomyPlace}
              aria-label="Related archive record at a glance"
            />
          </section>
        );
      }
    }
  }

  return (
    <Room>
      <RoomHeader
        pathname={`/books/${book.slug}`}
        crumbLabel={book.title}
        kicker={BOOKS_DETAIL.introKicker}
        title={book.title}
        showPath={false}
      />

      <div className="ds-books-edition__intro-grid">
        <BooksCoverArt
          title={book.title}
          {...(coverIsbn ? { isbn: coverIsbn } : {})}
          size="L"
          decorative={false}
          className="ds-books-edition__intro-cover"
        />
        <div>
          {states.length > 0 ? (
            <div
              className="ds-books-edition__tags"
              role="group"
              aria-label="States on challenge lists"
            >
              {states.map((state) => (
                <Link
                  key={state.code}
                  className="ds-books-edition__tag"
                  href={`/books?state=${encodeURIComponent(state.code)}`}
                  title={state.name}
                >
                  <span className="ds-visually-hidden">{state.name} </span>
                  {state.code}
                </Link>
              ))}
            </div>
          ) : null}
          {bookshop ? (
            <p className="ds-books-edition__actions">
              <a
                className="ds-cta ds-cta--copper"
                href={bookshop.href}
                rel="noopener noreferrer sponsored"
                target="_blank"
              >
                Buy on Bookshop
              </a>
            </p>
          ) : null}
          <BooksAnatomyStrip
            authorLine={authorLine}
            publishedDate={book.publishedDate}
            citationCount={book.citations.length}
            challengeCount={activeChallenges.length}
            stateCount={states.length}
            {...(isbn ? { isbn: isbn.value } : {})}
          />
        </div>
      </div>

      <BooksDetailSections view={view} relatedItems={relatedItems} placePanel={entityPlacePanel} />
    </Room>
  );
}
