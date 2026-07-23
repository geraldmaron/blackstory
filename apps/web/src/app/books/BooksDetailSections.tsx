/**
 * Books detail body — mirrors entity layout: numbered record sections + sticky context aside
 * with copper Buy CTA and provenance.
 */
import React from 'react';
import Link from 'next/link';
import type { BooksDetailViewModel } from './books-view-model';
import './books.css';

export type BooksDetailSectionsProps = {
  readonly view: Extract<BooksDetailViewModel, { readonly kind: 'ok' }>;
};

export function BooksDetailSections({ view }: BooksDetailSectionsProps) {
  const { book, states } = view;
  const bookshop = book.purchaseLinks.find((link) => link.retailer === 'bookshop');
  const otherPurchase = book.purchaseLinks.filter((link) => link.retailer !== 'bookshop');
  const activeChallenges = book.challenges.filter(
    (challenge) => challenge.status === 'reported' || challenge.status === 'unknown',
  );

  return (
    <div className="ds-entity-body">
      <div className="ds-entity-layout">
        <div className="ds-stack ds-entity-sections">
          <section className="ds-record-section" aria-labelledby="description-heading" id="description">
            <p className="ds-section__kicker">
              <span className="ds-kicker-index" aria-hidden="true" />
              Context
            </p>
            <h2 className="ds-section__title" id="description-heading">
              About this title
            </h2>
            <p className="ds-section__lede">{book.description}</p>
            {book.canonicalEntityId ? (
              <p className="ds-entity-footnote ds-sans">
                <Link href={`/entity/${book.canonicalEntityId}`}>
                  View related archive record ({book.canonicalEntityId})
                </Link>
              </p>
            ) : null}
          </section>

          <section className="ds-record-section" aria-labelledby="challenges-heading" id="challenges">
            <p className="ds-section__kicker">
              <span className="ds-kicker-index" aria-hidden="true" />
              Challenges
            </p>
            <h2 className="ds-section__title" id="challenges-heading">
              States on challenge lists
            </h2>
            <p className="ds-section__lede">
              Validated USPS codes for reported or unknown challenges. Rescinded entries are
              omitted. Codes follow cited public reports — not a claim of statewide removal.
            </p>
            <div className="ds-record-section__body">
              {states.length === 0 ? (
                <p className="ds-sans">No reported challenge jurisdictions on file.</p>
              ) : (
                <div className="ds-entity-tags" role="group" aria-label="States on challenge or ban lists">
                  {states.map((state) => (
                    <Link
                      key={state.code}
                      className="ds-entity-tag"
                      href={`/books?state=${encodeURIComponent(state.code)}`}
                    >
                      {state.name} · {state.code}
                    </Link>
                  ))}
                </div>
              )}

              {activeChallenges.length > 0 ? (
                <div className="ds-record-section__nested" aria-labelledby="jurisdiction-heading">
                  <h3 className="ds-subheading" id="jurisdiction-heading">
                    By jurisdiction
                  </h3>
                  <ul className="ds-books-evidence-list">
                    {activeChallenges.map((challenge, index) => (
                      <li key={`${challenge.state}-${index}`} className="ds-books-evidence-item">
                        <p className="ds-books-evidence-item__lead">
                          <span className="ds-books-evidence-item__where">
                            {states.find((entry) => entry.code === challenge.state)?.name ??
                              challenge.state}{' '}
                            <span className="ds-mono">({challenge.state})</span>
                          </span>
                          {challenge.jurisdictionLabel ? (
                            <span className="ds-books-evidence-item__scope">
                              {' '}
                              · {challenge.jurisdictionLabel}
                            </span>
                          ) : null}
                        </p>
                        <a
                          className="ds-books-evidence-item__cite"
                          href={challenge.citation.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {challenge.citation.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          <section className="ds-record-section" aria-labelledby="citations-heading" id="citations">
            <p className="ds-section__kicker">
              <span className="ds-kicker-index" aria-hidden="true" />
              Evidence
            </p>
            <h2 className="ds-section__title" id="citations-heading">
              Citations
            </h2>
            <div className="ds-record-section__body">
              <ul className="ds-books-evidence-list">
                {book.citations.map((citation) => (
                  <li key={citation.href} className="ds-books-evidence-item">
                    <a
                      className="ds-books-evidence-item__cite"
                      href={citation.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {citation.label}
                    </a>
                    {citation.publisher ? (
                      <p className="ds-books-evidence-item__meta">{citation.publisher}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="ds-record-section" aria-labelledby="books-detail-next">
            <p className="ds-section__kicker">
              <span className="ds-kicker-index" aria-hidden="true" />
              Connected
            </p>
            <h2 className="ds-section__title" id="books-detail-next">
              Keep going
            </h2>
            <p className="ds-entity-aside__cta">
              <Link className="ds-cta ds-cta--ink" href="/books">
                All challenged titles
              </Link>
              <Link className="ds-cta ds-cta--quiet" href="/search?kind=publication">
                Search publications
              </Link>
              <Link className="ds-cta ds-cta--quiet" href="/methodology">
                Methodology
              </Link>
            </p>
          </section>
        </div>

        <aside className="ds-entity-aside" aria-label="Book actions">
          <p className="ds-entity-aside__cta">
            {bookshop ? (
              <a
                className="ds-cta ds-cta--copper"
                href={bookshop.href}
                rel="noopener noreferrer sponsored"
                target="_blank"
              >
                Buy on Bookshop
              </a>
            ) : null}
            {otherPurchase.map((link) => (
              <a
                key={link.href}
                className="ds-cta ds-cta--quiet"
                href={link.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {link.label}
              </a>
            ))}
          </p>
          <p className="ds-entity-aside__precision ds-sans">
            Bookshop.org links support independent bookstores via BlackStory&apos;s affiliate
            referral. Open Library is a free catalog reference — not a purchase path.
          </p>

          {book.identifiers.length > 0 ? (
            <section className="ds-aside-block" aria-labelledby="ids-heading">
              <h2 className="ds-aside-block__title" id="ids-heading">
                Identifiers
              </h2>
              <dl className="ds-entity-meta-list">
                {book.identifiers.map((identifier) => (
                  <div
                    key={`${identifier.system}-${identifier.value}`}
                    className="ds-entity-meta-list__row"
                  >
                    <dt>{identifier.system}</dt>
                    <dd className="ds-mono">{identifier.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="ds-aside-block" aria-labelledby="provenance-heading">
            <h2 className="ds-aside-block__title" id="provenance-heading">
              Provenance
            </h2>
            <p className="ds-aside-block__meta ds-mono">{book.provenance.source}</p>
            <dl className="ds-entity-meta-list">
              <div className="ds-entity-meta-list__row">
                <dt>Retrieved</dt>
                <dd>{book.provenance.retrievedAt.split('T')[0]}</dd>
              </div>
              <div className="ds-entity-meta-list__row">
                <dt>Source URL</dt>
                <dd>
                  <a href={book.provenance.sourceUrl} rel="noopener noreferrer" target="_blank">
                    Open source
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
