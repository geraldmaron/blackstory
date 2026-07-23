/**
 * Books detail body: v6 edition Surface panels for context, challenges, evidence,
 * lookup, related titles, and connected depart links. Primary story stays above related.
 */
import React from 'react';
import Link from 'next/link';
import type { BooksBrowseItem, BooksDetailViewModel } from './books-view-model';
import { BooksRipRow } from './BooksRipRow';
import { booksEditionPanelClassName } from './books-panel-chrome';
import { BOOKS_DETAIL } from './books-copy';

export type BooksDetailSectionsProps = {
  readonly view: Extract<BooksDetailViewModel, { readonly kind: 'ok' }>;
  readonly relatedItems: readonly BooksBrowseItem[];
  readonly placePanel?: React.ReactNode;
};

export function BooksDetailSections({ view, relatedItems, placePanel }: BooksDetailSectionsProps) {
  const { book, states } = view;
  const otherPurchase = book.purchaseLinks.filter((link) => link.retailer !== 'bookshop');
  const activeChallenges = book.challenges.filter(
    (challenge) => challenge.status === 'reported' || challenge.status === 'unknown',
  );

  return (
    <>
      <article
        className={booksEditionPanelClassName('context')}
        aria-labelledby="description-heading"
        id="description"
      >
        <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.contextKicker}</p>
        <h2 className="ds-books-edition__panel-heading" id="description-heading">
          {BOOKS_DETAIL.contextTitle}
        </h2>
        <p className="ds-books-edition__body">{book.description}</p>
      </article>

      <article
        className={booksEditionPanelClassName('challenges')}
        aria-labelledby="challenges-heading"
        id="challenges"
      >
        <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.challengesKicker}</p>
        <h2 className="ds-books-edition__panel-heading" id="challenges-heading">
          {BOOKS_DETAIL.challengesTitle}
        </h2>
        <p className="ds-books-edition__lede">{BOOKS_DETAIL.challengesLede}</p>
        {states.length === 0 ? (
          <p className="ds-books-edition__footnote">No reported challenge jurisdictions on file.</p>
        ) : (
          <div className="ds-books-edition__tags" role="group" aria-label="States on challenge or ban lists">
            {states.map((state) => (
              <Link
                key={state.code}
                className="ds-books-edition__tag"
                href={`/books?state=${encodeURIComponent(state.code)}`}
              >
                {state.name} · {state.code}
              </Link>
            ))}
          </div>
        )}

        {activeChallenges.length > 0 ? (
          <div aria-labelledby="jurisdiction-heading">
            <h3 className="ds-books-edition__nested-heading" id="jurisdiction-heading">
              By jurisdiction
            </h3>
            <ul className="ds-books-edition__evidence-list">
              {activeChallenges.map((challenge, index) => (
                <li key={`${challenge.state}-${index}`} className="ds-books-edition__evidence-item">
                  <p className="ds-books-edition__evidence-lead">
                    <span>
                      {states.find((entry) => entry.code === challenge.state)?.name ??
                        challenge.state}{' '}
                      <span className="ds-mono">({challenge.state})</span>
                    </span>
                    {challenge.jurisdictionLabel ? (
                      <span className="ds-books-edition__evidence-scope">
                        {' '}
                        · {challenge.jurisdictionLabel}
                      </span>
                    ) : null}
                    {challenge.schoolYear ? (
                      <span className="ds-books-edition__evidence-scope">
                        {' '}
                        · {challenge.schoolYear}
                      </span>
                    ) : null}
                  </p>
                  <a
                    className="ds-books-edition__evidence-cite"
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
      </article>

      <article
        className={booksEditionPanelClassName('evidence')}
        aria-labelledby="citations-heading"
        id="citations"
      >
        <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.evidenceKicker}</p>
        <h2 className="ds-books-edition__panel-heading" id="citations-heading">
          {BOOKS_DETAIL.evidenceTitle}
        </h2>
        <ul className="ds-books-edition__evidence-list">
          {book.citations.map((citation) => (
            <li key={citation.href} className="ds-books-edition__evidence-item">
              <a
                className="ds-books-edition__evidence-cite"
                href={citation.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {citation.label}
              </a>
              {citation.publisher ? (
                <p className="ds-books-edition__evidence-meta">{citation.publisher}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </article>

      <article className={booksEditionPanelClassName('provenance')} aria-labelledby="purchase-heading">
        <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.lookupKicker}</p>
        <h2 className="ds-books-edition__panel-heading" id="purchase-heading">
          {BOOKS_DETAIL.lookupTitle}
        </h2>
        {otherPurchase.length > 0 ? (
          <p className="ds-books-edition__actions">
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
        ) : null}
        <p className="ds-books-edition__footnote">{BOOKS_DETAIL.lookupFootnote}</p>
        {book.identifiers.length > 0 ? (
          <section aria-labelledby="ids-heading">
            <p className="ds-books-edition__panel-title" id="ids-heading">
              Identifiers
            </p>
            <dl className="ds-books-edition__meta-list">
              {book.identifiers.map((identifier) => (
                <div
                  key={`${identifier.system}-${identifier.value}`}
                  className="ds-books-edition__meta-list-row"
                >
                  <dt>{identifier.system}</dt>
                  <dd className="ds-mono">{identifier.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <section aria-labelledby="provenance-heading">
          <p className="ds-books-edition__panel-title" id="provenance-heading">
            Provenance
          </p>
          <dl className="ds-books-edition__meta-list">
            <div className="ds-books-edition__meta-list-row">
              <dt>Source</dt>
              <dd className="ds-mono">{book.provenance.source}</dd>
            </div>
            <div className="ds-books-edition__meta-list-row">
              <dt>Retrieved</dt>
              <dd>{book.provenance.retrievedAt.split('T')[0]}</dd>
            </div>
            <div className="ds-books-edition__meta-list-row">
              <dt>Source URL</dt>
              <dd>
                <a href={book.provenance.sourceUrl} rel="noopener noreferrer" target="_blank">
                  Open source
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </article>

      {placePanel}

      {relatedItems.length > 0 || book.canonicalEntityId ? (
        <article
          className={booksEditionPanelClassName('related')}
          aria-labelledby="books-related-heading"
          id="related"
        >
          <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.relatedKicker}</p>
          <h2 className="ds-books-edition__panel-heading" id="books-related-heading">
            {BOOKS_DETAIL.relatedTitle}
          </h2>
          {book.canonicalEntityId ? (
            <p className="ds-books-edition__footnote">
              <Link href={`/entity/${book.canonicalEntityId}`}>
                View related archive record
              </Link>
            </p>
          ) : null}
          {relatedItems.length > 0 ? (
            <div className="ds-books-edition__rip-list ds-books-edition__rip-list--compact">
              {relatedItems.map((item, index) => (
                <BooksRipRow
                  key={item.id}
                  item={item}
                  sort="title"
                  dir="asc"
                  isFirst={index === 0}
                />
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      <article className={booksEditionPanelClassName('connected')} aria-labelledby="books-detail-next">
        <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.connectedKicker}</p>
        <h2 className="ds-books-edition__panel-heading" id="books-detail-next">
          {BOOKS_DETAIL.connectedTitle}
        </h2>
        <p className="ds-books-edition__actions">
          <Link className="ds-cta ds-cta--ink" href="/books">
            All challenged titles
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/history?kind=publication">
            Search publications
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Methodology
          </Link>
        </p>
      </article>
    </>
  );
}
