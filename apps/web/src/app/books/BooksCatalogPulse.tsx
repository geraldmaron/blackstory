/**
 * Browse intro catalog pulse: corpus size, author breadth, and state coverage in a
 * compact mono fact strip beneath the edition lede.
 */
import React from 'react';
import type { BannedBooksListingSnapshot } from '@repo/domain';
import { bannedBookReportedStates } from '@repo/domain';

void React;

export type BooksCatalogPulseProps = {
  readonly snapshot: BannedBooksListingSnapshot;
};

export function BooksCatalogPulse({ snapshot }: BooksCatalogPulseProps) {
  const titleCount = snapshot.books.length;
  const authorSet = new Set<string>();
  const stateSet = new Set<string>();

  for (const book of snapshot.books) {
    for (const author of book.authors) {
      if (author.name.trim()) authorSet.add(author.name.trim());
    }
    for (const code of bannedBookReportedStates(book)) {
      stateSet.add(code);
    }
  }

  const retrieved = snapshot.generatedAt.split('T')[0] ?? snapshot.generatedAt;

  return (
    <dl className="ds-books-edition__pulse" aria-label="Catalog snapshot">
      <div className="ds-books-edition__pulse-row">
        <dt>Titles</dt>
        <dd>{titleCount}</dd>
      </div>
      <div className="ds-books-edition__pulse-row">
        <dt>Authors</dt>
        <dd>{authorSet.size}</dd>
      </div>
      <div className="ds-books-edition__pulse-row">
        <dt>States cited</dt>
        <dd>{stateSet.size}</dd>
      </div>
      <div className="ds-books-edition__pulse-row">
        <dt>Snapshot</dt>
        <dd className="ds-mono">{retrieved}</dd>
      </div>
    </dl>
  );
}
