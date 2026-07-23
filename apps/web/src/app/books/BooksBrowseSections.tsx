/**
 * Books browse: edition catalog panel with typeahead search, facet filters, active chips,
 * sort toolbar, rip rows with fact stacks, pagination, and about panel.
 */
import React from 'react';
import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import type { BannedBookSuggestCorpusItem } from '../../lib/banned-books/suggest-books.js';
import { buildBooksBrowseHref, type BooksBrowseViewModel } from './books-view-model.js';
import { BooksSearchTypeahead } from './BooksSearchTypeahead.js';
import { BooksRipRow } from './BooksRipRow.js';
import { AutoSubmitSelect } from '../../components/forms/AutoSubmitSelect.js';
import { booksEditionPanelClassName } from './books-panel-chrome.js';
import { BOOKS_ABOUT, BOOKS_CATALOG } from './books-copy.js';
import '../typeahead.css';

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
  readonly suggestCorpus: readonly BannedBookSuggestCorpusItem[];
};

function sortIndicator(ariaSort: 'ascending' | 'descending' | 'none'): string {
  if (ariaSort === 'ascending') return ' ↑';
  if (ariaSort === 'descending') return ' ↓';
  return '';
}

function BooksActiveFilters({ view }: { readonly view: BooksBrowseViewModel }) {
  const chips: { readonly key: string; readonly label: string; readonly href: string }[] = [];

  if (view.q.trim()) {
    chips.push({
      key: 'q',
      label: `Search: ${view.q.trim()}`,
      href: buildBooksBrowseHref({
        q: '',
        state: view.state,
        author: view.author,
        sort: view.sort,
        dir: view.dir,
      }),
    });
  }

  if (view.state !== 'all') {
    const stateLabel = view.stateOptions.find((entry) => entry.value === view.state)?.label ?? view.state;
    chips.push({
      key: 'state',
      label: stateLabel,
      href: buildBooksBrowseHref({
        q: view.q,
        state: 'all',
        author: view.author,
        sort: view.sort,
        dir: view.dir,
      }),
    });
  }

  if (view.author !== 'all') {
    chips.push({
      key: 'author',
      label: view.author,
      href: buildBooksBrowseHref({
        q: view.q,
        state: view.state,
        author: 'all',
        sort: view.sort,
        dir: view.dir,
      }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="ds-books-edition__active-filters" aria-label="Active filters">
      <p className="ds-books-edition__active-filters-label">Filtered by</p>
      <ul className="ds-books-edition__active-filters-list">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link className="ds-books-edition__filter-chip" href={chip.href}>
              <span>{chip.label}</span>
              <span className="ds-visually-hidden">. Remove filter.</span>
            </Link>
          </li>
        ))}
        <li>
          <Link className="ds-cta-link ds-books-edition__clear-all" href="/books">
            Clear all
          </Link>
        </li>
      </ul>
    </div>
  );
}

function BooksPagination({ view }: { readonly view: BooksBrowseViewModel }) {
  const { pagination } = view;
  if (pagination.totalMatched === 0 || pagination.totalPages <= 1) return null;

  return (
    <nav className="ds-books-edition__pager" aria-label="Books catalog pages">
      <p className="ds-books-edition__count">
        Showing {pagination.rangeStart}–{pagination.rangeEnd} of {pagination.totalMatched}
      </p>
      <div className="ds-books-edition__pager-controls">
        {pagination.previousHref ? (
          <Link className="ds-cta ds-cta--quiet" href={pagination.previousHref} rel="prev">
            Previous
          </Link>
        ) : (
          <span className="ds-cta ds-cta--quiet ds-books-edition__pager-disabled" aria-disabled="true">
            Previous
          </span>
        )}
        <ul className="ds-books-edition__pager-pages">
          {pagination.pageHrefs.map((entry) => (
            <li key={entry.page}>
              {entry.current ? (
                <span
                  className="ds-books-edition__pager-page ds-books-edition__pager-page--current"
                  aria-current="page"
                >
                  {entry.page}
                </span>
              ) : (
                <Link className="ds-books-edition__pager-page" href={entry.href}>
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
          <span className="ds-cta ds-cta--quiet ds-books-edition__pager-disabled" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export function BooksBrowseSections({ view, suggestCorpus }: BooksBrowseSectionsProps) {
  const countLabel = `${view.totalMatched} title${view.totalMatched === 1 ? '' : 's'}`;

  return (
    <>
      <article
        className={booksEditionPanelClassName('catalog')}
        aria-labelledby="books-browse-heading"
        id="browse"
      >
        <header className="ds-books-edition__header">
          <span className="ds-books-edition__index" aria-hidden="true">
            01
          </span>
          <div>
            <p className="ds-books-edition__kicker">{BOOKS_CATALOG.kicker}</p>
            <h2 className="ds-books-edition__title" id="books-browse-heading">
              {BOOKS_CATALOG.title}
            </h2>
            <p className="ds-books-edition__lede">{BOOKS_CATALOG.lede}</p>
          </div>
        </header>

        <form className="ds-books-edition__refine" method="get" action="/books" role="search">
          <div className="ds-books-edition__refine-search">
            <BooksSearchTypeahead defaultValue={view.q} corpus={suggestCorpus} />
          </div>
          <div className="ds-books-edition__refine-filters">
            <AutoSubmitSelect
              id="state"
              name="state"
              label="State"
              defaultValue={view.state}
              options={view.stateOptions}
            />
            <AutoSubmitSelect
              id="author"
              name="author"
              label="Author"
              defaultValue={view.author}
              options={view.authorOptions}
            />
            <input type="hidden" name="sort" value={view.sort} />
            <input type="hidden" name="dir" value={view.dir} />
            <Link className="ds-cta-link" href="/books">
              Clear
            </Link>
          </div>
        </form>

        <BooksActiveFilters view={view} />

        <div className="ds-books-edition__toolbar">
          <p className="ds-books-edition__count" id="books-results-heading">
            {countLabel}
            {view.pagination.totalPages > 1
              ? ` · page ${view.pagination.page} of ${view.pagination.totalPages}`
              : null}
          </p>
          <div className="ds-books-edition__sort" role="group" aria-label="Sort catalog">
            <span className="ds-books-edition__sort-label">Sort</span>
            <ul className="ds-books-edition__sort-list">
              {view.sortOptions.map((option) => (
                <li key={option.key}>
                  <Link
                    className={
                      option.active
                        ? 'ds-books-edition__sort-link ds-books-edition__sort-link--active'
                        : 'ds-books-edition__sort-link'
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
            title={BOOKS_CATALOG.emptyTitle}
            action={
              <a className="ds-cta ds-cta--ink" href="/books">
                {BOOKS_CATALOG.emptyAction}
              </a>
            }
          >
            {BOOKS_CATALOG.emptyBody}
          </EmptyState>
        ) : (
          <div className="ds-books-edition__rip-list" aria-labelledby="books-results-heading">
            {view.items.map((item, index) => (
              <BooksRipRow
                key={item.id}
                item={item}
                sort={view.sort}
                dir={view.dir}
                isFirst={index === 0}
              />
            ))}
          </div>
        )}

        <BooksPagination view={view} />
      </article>

      <article
        className={booksEditionPanelClassName('about')}
        aria-labelledby="about-books-heading"
        id="about-books"
      >
        <header className="ds-books-edition__header">
          <span className="ds-books-edition__index" aria-hidden="true">
            02
          </span>
          <div>
            <p className="ds-books-edition__kicker">{BOOKS_ABOUT.kicker}</p>
            <h2 className="ds-books-edition__title" id="about-books-heading">
              {BOOKS_ABOUT.title}
            </h2>
            <p className="ds-books-edition__lede">{BOOKS_ABOUT.lede}</p>
            <p className="ds-books-edition__actions">
              <Link className="ds-cta ds-cta--quiet" href="/methodology">
                Methodology
              </Link>
              <Link className="ds-cta ds-cta--quiet" href="/history?kind=publication">
                Search publications
              </Link>
            </p>
          </div>
        </header>
      </article>
    </>
  );
}
