/**
 * Single challenged-title rip row for the books catalog: cover thumbnail, title link,
 * summary, and EditionFactIcon fact stack (author, year, citations, states).
 */
import React from 'react';
import Link from 'next/link';
import { EditionFactIcon } from '../../components/patterns/EditionFactIcon';
import type { BooksBrowseItem, BooksBrowseSortDir, BooksBrowseSortKey } from './books-view-model';
import { BooksCoverArt } from './BooksCoverArt';
import '../../components/patterns/edition-fact-icon.css';

void React;

export type BooksRipRowProps = {
  readonly item: BooksBrowseItem;
  readonly sort: BooksBrowseSortKey;
  readonly dir: BooksBrowseSortDir;
  readonly isFirst?: boolean;
};

function BrowseRowActions({ item }: { readonly item: BooksBrowseItem }) {
  if (item.purchaseLinks.length === 0) return null;
  const bookshop = item.purchaseLinks.find((link) => link.retailer === 'bookshop');

  return (
    <div className="ds-books-edition__rip-actions" aria-label={`Purchase options for ${item.title}`}>
      {bookshop ? (
        <a
          className="ds-cta ds-cta--copper ds-books-edition__rip-buy"
          href={bookshop.href}
          rel="noopener noreferrer sponsored"
          target="_blank"
        >
          Buy
        </a>
      ) : null}
      <Link className="ds-cta ds-cta--quiet" href={`/books/${item.slug}`}>
        Details
      </Link>
    </div>
  );
}

function stateFactValue(
  item: BooksBrowseItem,
  sort: BooksBrowseSortKey,
  dir: BooksBrowseSortDir,
): React.ReactNode {
  if (item.states.length === 0) {
    return 'None on file';
  }
  return (
    <>
      {item.states.map((state, index) => (
        <React.Fragment key={state.code}>
          {index > 0 ? ' ' : null}
          <Link
            className="ds-books-edition__rip-fact-link"
            href={`/books?state=${encodeURIComponent(state.code)}&sort=${sort}&dir=${dir}`}
            title={state.name}
          >
            <span className="ds-visually-hidden">{state.name} </span>
            {state.code}
          </Link>
        </React.Fragment>
      ))}
    </>
  );
}

export function BooksRipRow({ item, sort, dir, isFirst = false }: BooksRipRowProps) {
  return (
    <article
      className="ds-books-edition__rip-row"
      {...(isFirst ? { 'data-first-row': true } : {})}
    >
      <div className="ds-books-edition__rip-main">
        <BooksCoverArt title={item.title} {...(item.coverIsbn ? { isbn: item.coverIsbn } : {})} />
        <div className="ds-books-edition__rip-body">
          <h3 className="ds-books-edition__rip-title">
            <Link className="ds-books-edition__rip-link" href={`/books/${item.slug}`}>
              {item.title}
            </Link>
          </h3>
          <p className="ds-books-edition__rip-summary">{item.summary}</p>
          <dl className="ds-books-edition__rip-facts">
            <div className="ds-books-edition__rip-fact">
              <dt className="ds-books-edition__rip-fact-label">
                <EditionFactIcon variant="entry" step="source" />
                Author
              </dt>
              <dd className="ds-books-edition__rip-fact-value">{item.authorNames}</dd>
            </div>
            <div className="ds-books-edition__rip-fact">
              <dt className="ds-books-edition__rip-fact-label">
                <EditionFactIcon variant="record-era" />
                Year
              </dt>
              <dd className="ds-books-edition__rip-fact-value">{item.publishedDate}</dd>
            </div>
            <div className="ds-books-edition__rip-fact">
              <dt className="ds-books-edition__rip-fact-label">
                <EditionFactIcon variant="record-evidence" tier="high" />
                Citations
              </dt>
              <dd className="ds-books-edition__rip-fact-value">
                {item.citationCount} source{item.citationCount === 1 ? '' : 's'}
              </dd>
            </div>
            <div className="ds-books-edition__rip-fact">
              <dt className="ds-books-edition__rip-fact-label">
                <EditionFactIcon variant="record-where" />
                States
              </dt>
              <dd className="ds-books-edition__rip-fact-value">{stateFactValue(item, sort, dir)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <BrowseRowActions item={item} />
    </article>
  );
}
