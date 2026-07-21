/**
 * Books catalog typeahead — ranks the in-memory listing corpus (title / author / summary)
 * and navigates to the book detail page on pick.
 */
'use client';

import React, { useCallback } from 'react';
import {
  suggestBannedBooks,
  type BannedBookSuggestCorpusItem,
} from '../../lib/banned-books/suggest-books.js';
import {
  TypeaheadCombobox,
  type TypeaheadSuggestion,
} from '../../components/typeahead/TypeaheadCombobox.js';

export type BooksSearchTypeaheadProps = {
  readonly defaultValue: string;
  readonly corpus: readonly BannedBookSuggestCorpusItem[];
};

export function BooksSearchTypeahead({ defaultValue, corpus }: BooksSearchTypeaheadProps) {
  const suggestLocal = useCallback(
    (query: string): readonly TypeaheadSuggestion[] =>
      suggestBannedBooks(query, corpus, 8).map((book) => ({
        id: book.id,
        primary: book.title,
        secondary: book.authorNames,
        href: book.href,
      })),
    [corpus],
  );

  return (
    <TypeaheadCombobox
      id="q"
      name="q"
      label="Search"
      labelClassName="ds-filters__label"
      placeholder="Title, author, or summary…"
      defaultValue={defaultValue}
      className="ds-typeahead ds-typeahead--filter"
      inputClassName="ds-filters__control"
      listLabel="Suggested titles"
      suggestLocal={suggestLocal}
    />
  );
}
