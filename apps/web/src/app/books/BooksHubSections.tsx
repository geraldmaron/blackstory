/**
 * Readable Banned books chapter for `/how-it-works#books`. Catalog browse tools live at
 * `/books/browse`.
 */
import React from 'react';
import Link from 'next/link';
import type { BannedBooksListingSnapshot } from '@repo/domain';
import { EmptyList, Prose } from '../../components/room';
import { BOOKS_ABOUT, BOOKS_INTRO } from './books-copy';

void React;

const SAMPLE_COUNT = 8;

export type BooksHubSectionsProps = {
  readonly snapshot: BannedBooksListingSnapshot;
};

export function BooksHubSections({ snapshot }: BooksHubSectionsProps) {
  const sample = snapshot.books.slice(0, SAMPLE_COUNT);

  return (
    <>
      <Prose>
        <p>{BOOKS_INTRO.lede}</p>
      </Prose>

      <section aria-labelledby="hub-books-how-heading">
        <h3 id="hub-books-how-heading" className="ds-room-grouphd">
          {BOOKS_ABOUT.title}
        </h3>
        <Prose>
          <p>{BOOKS_ABOUT.lede}</p>
        </Prose>
      </section>

      {sample.length === 0 ? (
        <EmptyList title="The catalog snapshot is unavailable">
          We could not load challenged titles just now. Check back shortly, or read the{' '}
          <Link href="/how-it-works?s=methodology">methodology</Link> for how this catalog is built.
        </EmptyList>
      ) : (
        <ol className="ds-room-idx" aria-label="Sample challenged titles">
          {sample.map((book) => (
            <li key={book.id} className="ds-room-idx__row">
              <Link className="ds-room-idx__name" href={`/books/${book.slug}`}>
                {book.title}
              </Link>
              <p className="ds-room-idx__meta">
                {[book.authors.map((author) => author.name).join(', '), book.publishedDate]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </li>
          ))}
        </ol>
      )}

      <Prose>
        <p>
          <Link href="/books/browse">Browse and filter the full banned-books catalog</Link>
          {snapshot.books.length > 0
            ? ` (${snapshot.books.length.toLocaleString('en-US')} titles).`
            : '.'}{' '}
          Search by title or author; filter by state.
        </p>
      </Prose>
    </>
  );
}

/** @deprecated Prefer {@link BooksHubSections}. */
export const BooksApparatusSections = BooksHubSections;
export type BooksApparatusSectionsProps = BooksHubSectionsProps;
