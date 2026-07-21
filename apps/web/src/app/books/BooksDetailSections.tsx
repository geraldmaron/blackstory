/**
 * Books detail page sections: description, identifiers, challenges, citations, and purchase links.
 */
import React from 'react';
import Link from 'next/link';
import type { BooksDetailViewModel } from './books-view-model';
import './books.css';

const DETAIL_SECTIONS = [
  { id: 'description', label: 'Description' },
  { id: 'identifiers', label: 'Identifiers' },
  { id: 'challenges', label: 'States on lists' },
  { id: 'citations', label: 'Citations' },
  { id: 'purchase', label: 'Buy this book' },
  { id: 'provenance', label: 'Provenance' },
] as const;

export type BooksDetailSectionsProps = {
  readonly view: Extract<BooksDetailViewModel, { readonly kind: 'ok' }>;
};

export function BooksDetailSections({ view }: BooksDetailSectionsProps) {
  const { book, states } = view;

  return (
    <div className="ds-books">
      <aside className="ds-books__disclaimer" aria-labelledby="books-detail-disclaimer-heading">
        <h2 className="ds-books__disclaimer-title" id="books-detail-disclaimer-heading">
          About reported challenges
        </h2>
        <p>
          Challenges listed here are reported restrictions or removals from school and library
          contexts. State codes follow the cited public reports and national indexes; they are not
          a claim that every title was removed in every district of that state. Status may change;
          this page is not a complete national census.
        </p>
      </aside>

      <nav className="ds-books__nav" aria-labelledby="books-detail-toc-title">
        <p className="ds-books__nav-title" id="books-detail-toc-title">
          On this page
        </p>
        <ul className="ds-books__nav-list">
          {DETAIL_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-books__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section
        className="ds-section ds-record-section"
        aria-labelledby="description-heading"
        id="description"
      >
        <h2 className="ds-section__title" id="description-heading">
          Description
        </h2>
        <p className="ds-books__section-body">{book.description}</p>
      </section>

      <section
        className="ds-section ds-record-section"
        aria-labelledby="identifiers-heading"
        id="identifiers"
      >
        <h2 className="ds-section__title" id="identifiers-heading">
          Identifiers
        </h2>
        <dl className="ds-books__provenance-dl">
          {book.identifiers.map((identifier) => (
            <div key={`${identifier.system}-${identifier.value}`} className="ds-books__provenance-row">
              <dt>{identifier.system}</dt>
              <dd className="ds-mono">{identifier.value}</dd>
            </div>
          ))}
        </dl>
        {book.canonicalEntityId ? (
          <p className="ds-books__entity-link">
            <Link href={`/entity/${book.canonicalEntityId}`}>
              View related archive record ({book.canonicalEntityId})
            </Link>
          </p>
        ) : null}
      </section>

      <section
        className="ds-section ds-record-section"
        aria-labelledby="challenges-heading"
        id="challenges"
      >
        <h2 className="ds-section__title" id="challenges-heading">
          States on challenge lists
        </h2>
        <p className="ds-books__section-note">
          USPS state codes validated against the cited public reports. Codes appear only when a
          challenge is reported or status is unknown — rescinded entries are omitted from this list.
        </p>
        {states.length === 0 ? (
          <p className="ds-books__section-body">No reported challenge jurisdictions on file.</p>
        ) : (
          <ul className="ds-books__state-list" aria-label="States on challenge or ban lists">
            {states.map((state) => (
              <li key={state.code}>
                <span className="ds-books__state-name">{state.name}</span>{' '}
                <span className="ds-mono">({state.code})</span>
              </li>
            ))}
          </ul>
        )}
        {book.challenges.length > 0 ? (
          <>
            <h3 className="ds-books__subheading">Challenge citations by jurisdiction</h3>
            <ul className="ds-books__challenge-list">
              {book.challenges
                .filter((challenge) => challenge.status === 'reported' || challenge.status === 'unknown')
                .map((challenge, index) => (
                  <li key={`${challenge.state}-${index}`}>
                    <span className="ds-books__state-name">
                      {states.find((entry) => entry.code === challenge.state)?.name ?? challenge.state}
                    </span>{' '}
                    <span className="ds-mono">({challenge.state})</span>
                    {challenge.jurisdictionLabel ? (
                      <span> — {challenge.jurisdictionLabel}</span>
                    ) : null}
                    {' · '}
                    <a href={challenge.citation.href} rel="noopener noreferrer" target="_blank">
                      {challenge.citation.label}
                    </a>
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </section>

      <section
        className="ds-section ds-record-section"
        aria-labelledby="citations-heading"
        id="citations"
      >
        <h2 className="ds-section__title" id="citations-heading">
          Citations
        </h2>
        <ul className="ds-books__citation-list">
          {book.citations.map((citation) => (
            <li key={citation.href}>
              <a href={citation.href} rel="noopener noreferrer" target="_blank">
                {citation.label}
              </a>
              {citation.publisher ? (
                <span className="ds-books__citation-publisher"> — {citation.publisher}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {book.purchaseLinks.length > 0 ? (
        <section
          className="ds-section ds-record-section"
          aria-labelledby="purchase-heading"
          id="purchase"
        >
          <h2 className="ds-section__title" id="purchase-heading">
            Buy this book
          </h2>
          <p className="ds-books__section-note">
            Bookshop.org links support independent bookstores via BlackStory&apos;s affiliate
            referral. Open Library is a free catalog reference — not a purchase path.
          </p>
          <ul className="ds-books__purchase-list">
            {book.purchaseLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} rel="noopener noreferrer sponsored" target="_blank">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="ds-section ds-record-section"
        aria-labelledby="provenance-heading"
        id="provenance"
      >
        <h2 className="ds-section__title" id="provenance-heading">
          Provenance
        </h2>
        <dl className="ds-books__provenance-dl">
          <div className="ds-books__provenance-row">
            <dt>Source</dt>
            <dd>{book.provenance.source}</dd>
          </div>
          <div className="ds-books__provenance-row">
            <dt>Retrieved</dt>
            <dd>{book.provenance.retrievedAt.split('T')[0]}</dd>
          </div>
          <div className="ds-books__provenance-row">
            <dt>Source URL</dt>
            <dd>
              <a href={book.provenance.sourceUrl} rel="noopener noreferrer" target="_blank">
                {book.provenance.sourceUrl}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="ds-section ds-books__next" aria-labelledby="books-detail-next">
        <h2 className="ds-section__title" id="books-detail-next">
          Keep going
        </h2>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/books">
            All challenged titles
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/search?kind=publication">
            Search publications
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
        </p>
      </section>
    </div>
  );
}
