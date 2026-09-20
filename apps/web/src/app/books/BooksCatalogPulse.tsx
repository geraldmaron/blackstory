/**
 * Catalog pulse: corpus size, author breadth, and state coverage as mono facts for
 * DocumentColophon. Pure computation, no chrome of its own.
 */
import type { BannedBooksListingSnapshot } from '@repo/domain';
import { bannedBookReportedStates } from '@repo/domain';

export function booksCatalogPulseMeta(snapshot: BannedBooksListingSnapshot): readonly string[] {
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

  return [
    `${titleCount.toLocaleString('en-US')} title${titleCount === 1 ? '' : 's'}`,
    `${authorSet.size.toLocaleString('en-US')} author${authorSet.size === 1 ? '' : 's'}`,
    `${stateSet.size.toLocaleString('en-US')} state${stateSet.size === 1 ? '' : 's'} cited`,
    `As of ${retrieved}`,
  ];
}

/**
 * The same three counts as figures for the ledger stat row. The retrieval date is not a count, so
 * it stays in the colophon line.
 */
export function booksCatalogStats(
  snapshot: BannedBooksListingSnapshot,
): readonly { readonly value: number; readonly label: string }[] {
  const authors = new Set<string>();
  const states = new Set<string>();
  for (const book of snapshot.books) {
    for (const author of book.authors) {
      if (author.name.trim()) authors.add(author.name.trim());
    }
    for (const code of bannedBookReportedStates(book)) states.add(code);
  }
  const titles = snapshot.books.length;
  return [
    { value: titles, label: titles === 1 ? 'title' : 'titles' },
    { value: authors.size, label: authors.size === 1 ? 'author' : 'authors' },
    { value: states.size, label: states.size === 1 ? 'state cited' : 'states cited' },
  ];
}
