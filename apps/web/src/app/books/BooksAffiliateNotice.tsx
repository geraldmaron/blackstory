/**
 * The Bookshop affiliate call to action: the only commercial element on `/books/[slug]`.
 *
 * SP-12b (repo-92n2.12.2) requires this to sit below the evidence sections (challenges,
 * citations), separated from them by a hairline rule, and to name itself as an affiliate
 * link in plain body text next to the button, so it never reads as evidence. `.ds-room-section`
 * is the section's own hairline rule (see reading-room.css); this block gets no other treatment
 * than the room kit's other detail sections, which is what keeps it from reading as a fact.
 */
import React from 'react';
import { BOOKS_DETAIL } from './books-copy';

void React;

export type BooksAffiliateNoticeProps = {
  readonly href: string;
};

export function BooksAffiliateNotice({ href }: BooksAffiliateNoticeProps) {
  return (
    <section className="ds-room-section" aria-labelledby="books-affiliate-heading">
      <p className="ds-books-edition__panel-title">{BOOKS_DETAIL.affiliateKicker}</p>
      <h2 className="ds-books-edition__panel-heading" id="books-affiliate-heading">
        {BOOKS_DETAIL.affiliateTitle}
      </h2>
      <p className="ds-books-edition__actions">
        <a
          className="ds-cta ds-cta--copper"
          href={href}
          rel="noopener noreferrer sponsored"
          target="_blank"
        >
          Buy on Bookshop
        </a>
      </p>
      <p className="ds-books-edition__footnote">{BOOKS_DETAIL.affiliateNotice}</p>
    </section>
  );
}
