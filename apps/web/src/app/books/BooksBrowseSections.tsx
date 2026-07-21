/**
 * Books browse: filters, sort toolbar, responsive summary cards, and pagination.
 */
import React from 'react';
import Link from 'next/link';
import { EmptyState, FilterBar } from '@repo/ui';
import type { BooksBrowseItem, BooksBrowseViewModel } from './books-view-model';
import './books.css';

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
};

function BrowseCardActions({ item }: { readonly item: BooksBrowseItem }) {
  if (item.purchaseLinks.length === 0) return null;
  const bookshop = item.purchaseLinks.find((link) => link.retailer === 'bookshop');
  const others = item.purchaseLinks.filter((link) => link.retailer !== 'bookshop');

  return (
    <div className="ds-books-card__actions" aria-label={`Purchase options for ${item.title}`}>
      {bookshop ? (
        <a
          className="ds-cta ds-cta--copper ds-books-card__buy"
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
          className="ds-cta ds-cta--quiet ds-books-card__buy"
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

function sortIndicator(ariaSort: 'ascending' | 'descending' | 'none'): string {
  if (ariaSort === 'ascending') return ' ↑';
  if (ariaSort === 'descending') return ' ↓';
  return '';
}

function BooksPagination({ view }: { readonly view: BooksBrowseViewModel }) {
  const { pagination } = view;
  if (pagination.totalMatched === 0 || pagination.totalPages <= 1) return null;

  return (
    <nav className="ds-books-pager" aria-label="Books catalog pages">
      <p className="ds-books-pager__status ds-sans ds-count-label">
        Showing {pagination.rangeStart}–{pagination.rangeEnd} of {pagination.totalMatched}
      </p>
      <div className="ds-books-pager__controls">
        {pagination.previousHref ? (
          <Link className="ds-cta ds-cta--quiet" href={pagination.previousHref} rel="prev">
            Previous
          </Link>
        ) : (
          <span className="ds-cta ds-cta--quiet ds-books-pager__disabled" aria-disabled="true">
            Previous
          </span>
        )}
        <ul className="ds-books-pager__pages">
          {pagination.pageHrefs.map((entry) => (
            <li key={entry.page}>
              {entry.current ? (
                <span className="ds-books-pager__page ds-books-pager__page--current" aria-current="page">
                  {entry.page}
                </span>
              ) : (
                <Link className="ds-books-pager__page" href={entry.href}>
                  <span className="ds-visually-hidden">Page </span>
                  {entry.page}
                </Link>
              )}
            </li>
          ))}
        </ul>
        {pagination.nextHref ? (
          <Link className="ds-cta ds-cta--quiet" href={pagination.nextHref} rel="next">
            Next
          </Link>
        ) : (
          <span className="ds-cta ds-cta--quiet ds-books-pager__disabled" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
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
              placeholder: 'Title, author, or summary…',
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
          actions={
            <>
              <input type="hidden" name="sort" value={view.sort} />
              <input type="hidden" name="dir" value={view.dir} />
              <button type="submit" className="ds-button ds-button--primary">
                Apply filters
              </button>
            </>
          }
        />

        <div className="ds-books-browse__toolbar">
          <p className="ds-sans ds-count-label ds-books-browse__count" id="books-results-heading">
            {view.totalMatched} title{view.totalMatched === 1 ? '' : 's'}
            {view.pagination.totalPages > 1
              ? ` · page ${view.pagination.page} of ${view.pagination.totalPages}`
              : null}
          </p>
          <div className="ds-books-sort" role="group" aria-label="Sort catalog">
            <span className="ds-books-sort__label">Sort</span>
            <ul className="ds-books-sort__list">
              {view.sortOptions.map((option) => (
                <li key={option.key}>
                  <Link
                    className={
                      option.active ? 'ds-books-sort__link ds-books-sort__link--active' : 'ds-books-sort__link'
                    }
                    href={option.href}
                    aria-current={option.active ? 'true' : undefined}
                    aria-label={
                      option.ariaSort === 'none'
                        ? `Sort by ${option.label}`
                        : `Sort by ${option.label}, currently ${option.ariaSort}. Activate to reverse.`
                    }
                  >
                    {option.label}
                    <span aria-hidden="true">{sortIndicator(option.ariaSort)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

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
          <ul className="ds-books-grid" aria-labelledby="books-results-heading">
            {view.items.map((item) => (
              <li key={item.id} className="ds-books-card">
                <article className="ds-books-card__body">
                  <header className="ds-books-card__header">
                    <h3 className="ds-books-card__title">
                      <Link href={`/books/${item.slug}`}>{item.title}</Link>
                    </h3>
                    <p className="ds-books-card__byline">
                      <span>{item.authorNames}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="ds-mono">{item.publishedDate}</span>
                    </p>
                  </header>
                  <p className="ds-books-card__summary">{item.summary}</p>
                  <div className="ds-books-card__meta">
                    <p className="ds-books-card__citations ds-mono">
                      {item.citationCount} citation{item.citationCount === 1 ? '' : 's'}
                    </p>
                    {item.states.length > 0 ? (
                      <p className="ds-books-card__states" role="list" aria-label="States on challenge lists">
                        {item.states.map((state, index) => (
                          <span key={state.code} role="listitem">
                            {index > 0 ? <span aria-hidden="true"> </span> : null}
                            <Link
                              className="ds-books-row__state"
                              href={`/books?state=${encodeURIComponent(state.code)}&sort=${view.sort}&dir=${view.dir}`}
                              title={state.name}
                            >
                              <span className="ds-visually-hidden">{state.name} </span>
                              {state.code}
                            </Link>
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                  <footer className="ds-books-card__footer">
                    <Link className="ds-cta ds-cta--quiet" href={`/books/${item.slug}`}>
                      Details
                    </Link>
                    <BrowseCardActions item={item} />
                  </footer>
                </article>
              </li>
            ))}
          </ul>
        )}

        <BooksPagination view={view} />
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
