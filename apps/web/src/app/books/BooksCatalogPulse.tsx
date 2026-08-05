/**
 * Catalog pulse: corpus size, author breadth, and state coverage as mono facts for the
 * `RoomHeader` meta row. Pure computation, no chrome of its own; the room kit's header owns
 * how a meta row renders.
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
