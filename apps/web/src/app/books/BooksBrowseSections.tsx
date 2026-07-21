/**
 * Books browse page sections: disclaimer, on-page nav, filters, and ledger results.
 */
import React from 'react';
import Link from 'next/link';
import { EmptyState, FilterBar } from '@repo/ui';
import type { BooksBrowseViewModel } from './books-view-model';
import './books.css';

const BROWSE_SECTIONS = [
  { id: 'browse', label: 'Browse' },
  { id: 'about-books', label: 'About this page' },
] as const;

export type BooksBrowseSectionsProps = {
  readonly view: BooksBrowseViewModel;
};

export function BooksBrowseSections({ view }: BooksBrowseSectionsProps) {
  return (
    <div className="ds-books">
      <aside className="ds-books__disclaimer" aria-labelledby="books-disclaimer-heading">
        <h2 className="ds-books__disclaimer-title" id="books-disclaimer-heading">
          About reported challenges
        </h2>
        <p>
          Entries document reported restrictions or removals from school and library contexts. Each
          challenge is tied to a citation; status may change as districts review or restore access.
          State codes reflect jurisdictions named in the cited public reports and national indexes —
          not a claim that every title was removed in every district of that state. This listing is
          curated and evidence-linked — not a complete national census of every challenge filed.
        </p>
      </aside>

      <nav className="ds-books__nav" aria-labelledby="books-toc-title">
        <p className="ds-books__nav-title" id="books-toc-title">
          On this page
        </p>
        <ul className="ds-books__nav-list">
          {BROWSE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-books__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section
        className="ds-section ds-record-section ds-section--flush ds-books__filter-band"
        aria-labelledby="books-browse-heading"
        id="browse"
      >
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          Reported challenges
        </p>
        <h2 className="ds-section__title" id="books-browse-heading">
          Browse the catalog
        </h2>
        <p className="ds-section__lede">
          Filter by state or author, or search by title. Each entry links to citations and reported
          challenge jurisdictions.
        </p>

        <FilterBar
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

        <p className="ds-books__count" id="books-results-heading">
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
          <ul className="ds-books__browse-ledger" aria-labelledby="books-results-heading">
            {view.items.map((item) => (
              <li key={item.id} className="ds-books__browse-item">
                <div className="ds-books__browse-head">
                  <h3 className="ds-books__browse-title">
                    <Link href={`/books/${item.slug}`}>{item.title}</Link>
                  </h3>
                </div>
                <p className="ds-books__browse-meta-line">
                  <span>{item.authorNames}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="ds-mono">{item.publishedDate}</span>
                </p>
                {item.states.length > 0 ? (
                  <p className="ds-books__browse-states">
                    <span className="ds-books__browse-states-label">Reported challenge lists:</span>{' '}
                    <span className="ds-books__state-tags" role="list">
                      {item.states.map((state) => (
                        <span
                          key={state.code}
                          className="ds-books__state-tag"
                          role="listitem"
                          title={state.name}
                        >
                          <span className="ds-visually-hidden">{state.name} </span>
                          <span aria-hidden="true">{state.code}</span>
                        </span>
                      ))}
                    </span>
                  </p>
                ) : null}
                <p className="ds-books__browse-note">
                  {item.citationCount} citation{item.citationCount === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="ds-section ds-record-section ds-books__next"
        aria-labelledby="about-books-heading"
        id="about-books"
      >
        <h2 className="ds-section__title" id="about-books-heading">
          About this page
        </h2>
        <p className="ds-section__lede">
          BlackStory surfaces challenged titles with public evidence — not to sensationalize
          restrictions, but to show where access disputes intersect with Black history and related
          reading. For archive publications beyond this reference list, use Search.
        </p>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/about">
            About BlackStory
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/search?kind=publication">
            Search publications
          </Link>
        </p>
      </section>
    </div>
  );
}
