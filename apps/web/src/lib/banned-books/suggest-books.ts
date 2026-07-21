/**
 * Suggest banned-book catalog rows for `/books` typeahead. Pure ranking over an in-memory
 * corpus (seed or materialized snapshot) — no network.
 */
import type { BannedBookRecord } from '@repo/domain';
import { typeaheadMatchTier } from '../typeahead/match';

export type BannedBookSuggestion = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authorNames: string;
  readonly summary: string;
  readonly href: string;
};

export type BannedBookSuggestCorpusItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authorNames: string;
  readonly summary: string;
};

export function bannedBookToSuggestCorpusItem(book: BannedBookRecord): BannedBookSuggestCorpusItem {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    authorNames: book.authors.map((author) => author.name).join(', '),
    summary: book.description.trim(),
  };
}

/**
 * Returns up to `limit` books matching title, author, or summary
 * (exact → prefix → substring on the strongest field).
 */
export function suggestBannedBooks(
  query: string,
  corpus: readonly BannedBookSuggestCorpusItem[],
  limit = 8,
): readonly BannedBookSuggestion[] {
  type Ranked = {
    readonly suggestion: BannedBookSuggestion;
    readonly tier: number;
    readonly title: string;
  };
  const ranked: Ranked[] = [];

  for (const book of corpus) {
    const titleTier = typeaheadMatchTier(query, book.title);
    const authorTier = typeaheadMatchTier(query, book.authorNames);
    const summaryTier = Math.max(0, typeaheadMatchTier(query, book.summary) - 15);
    const tier = Math.max(titleTier, authorTier, summaryTier);
    if (tier === 0) continue;

    ranked.push({
      tier,
      title: book.title,
      suggestion: {
        id: book.id,
        slug: book.slug,
        title: book.title,
        authorNames: book.authorNames,
        summary: book.summary,
        href: `/books/${book.slug}`,
      },
    });
  }

  ranked.sort(
    (left, right) =>
      right.tier - left.tier ||
      left.title.localeCompare(right.title) ||
      left.suggestion.id.localeCompare(right.suggestion.id),
  );

  return ranked.slice(0, limit).map((row) => row.suggestion);
}
