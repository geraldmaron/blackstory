/**
 * Books browse: dense filter + ledger rows with entity-tag state chips and inline Buy CTAs.
 */
import React from 'react';
import Link from 'next/link';
import { EmptyState, FilterBar } from '@repo/ui';
import type { BooksBrowseItem, BooksBrowseViewModel } from './books-view-model';
import './books.css';

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
};

function BrowseRowActions({ item }: { readonly item: BooksBrowseItem }) {
  if (item.purchaseLinks.length === 0) return null;
  const bookshop = item.purchaseLinks.find((link) => link.retailer === 'bookshop');
  const others = item.purchaseLinks.filter((link) => link.retailer !== 'bookshop');

  return (
    <div className="ds-books-row__actions" aria-label={`Purchase options for ${item.title}`}>
      {bookshop ? (
        <a
          className="ds-cta ds-cta--copper ds-books-row__buy"
          href={bookshop.href}
          rel="noopener noreferrer sponsored"
          target="_blank"
        >
          Buy
        </a>
      ) : null}
      {others.map((link) => (
        <a
          key={link.href}
          className="ds-cta ds-cta--quiet ds-books-row__buy"
          href={link.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {link.retailer === 'open-library' ? 'Open Library' : link.label}
        </a>
      ))}
    </div>
  );
}

export function BooksBrowseSections({ view }: BooksBrowseSectionsProps) {
  return (
    <div className="ds-books-browse">
      <section
        className="ds-section ds-section--flush ds-books-browse__filters"
        aria-labelledby="books-browse-heading"
        id="browse"
      >
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          Catalog
        </p>
        <h2 className="ds-section__title" id="books-browse-heading">
          Challenged titles
        </h2>

        <FilterBar
          className="ds-books-browse__filter-bar"
          method="get"
          action="/books"
          legend="Filter challenged books"
          fields={[
            {
              id: 'q',
              name: 'q',
              label: 'Search',
              type: 'search',
              placeholder: 'Title or author…',
              defaultValue: view.q,
            },
            {
              id: 'state',
              name: 'state',
              label: 'State',
              type: 'select',
              defaultValue: view.state,
              options: view.stateOptions,
            },
            {
              id: 'author',
              name: 'author',
              label: 'Author',
              type: 'select',
              defaultValue: view.author,
              options: view.authorOptions,
            },
          ]}
        />

        <p className="ds-sans ds-count-label ds-books-browse__count" id="books-results-heading">
          {view.totalMatched} title{view.totalMatched === 1 ? '' : 's'}
        </p>

        {view.items.length === 0 ? (
          <EmptyState
            title="No titles matched"
            action={
              <a className="ds-cta ds-cta--ink" href="/books">
                Clear filters
              </a>
            }
          >
            Try a broader keyword or reset the state and author filters.
          </EmptyState>
        ) : (
          <ul className="ds-books-ledger" aria-labelledby="books-results-heading">
            {view.items.map((item) => (
              <li key={item.id} className="ds-books-row">
                <div className="ds-books-row__main">
                  <h3 className="ds-books-row__title">
                    <Link href={`/books/${item.slug}`}>{item.title}</Link>
                  </h3>
                  <p className="ds-books-row__meta">
                    <span>{item.authorNames}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="ds-mono">{item.publishedDate}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="ds-mono">
                      {item.citationCount} citation{item.citationCount === 1 ? '' : 's'}
                    </span>
                    {item.states.length > 0 ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="ds-books-row__states" role="list" aria-label="States on challenge lists">
                          {item.states.map((state, index) => (
                            <span key={state.code} role="listitem">
                              {index > 0 ? <span aria-hidden="true"> </span> : null}
                              <Link
                                className="ds-books-row__state"
                                href={`/books?state=${encodeURIComponent(state.code)}`}
                                title={state.name}
                              >
                                <span className="ds-visually-hidden">{state.name} </span>
                                {state.code}
                              </Link>
                            </span>
                          ))}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <BrowseRowActions item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ds-record-section" aria-labelledby="about-books-heading" id="about-books">
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          About
        </p>
        <h2 className="ds-section__title" id="about-books-heading">
          How to read this list
        </h2>
        <p className="ds-section__lede">
          Entries document reported school and library restrictions with public citations. State
          codes are validated USPS abbreviations from those reports — not a claim of statewide
          removal. Bookshop.org links use BlackStory&apos;s affiliate referral to support independent
          bookstores.
        </p>
        <p className="ds-entity-aside__cta">
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Methodology
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/search?kind=publication">
            Search publications
          </Link>
        </p>
      </section>
    </div>
  );
}
