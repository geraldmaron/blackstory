/**
 * The bar's search, as a real search.
 *
 * Off the Atlas this slot used to be an anchor to /records: it looked exactly like the Atlas's
 * search field, in the same place, at the same size, and typing into it was impossible because
 * it was a link. On twelve of the thirteen rooms the only way to search was to navigate away
 * first. This makes it a live combobox instead, so a reader types where the search box is and
 * sees matching records under the cursor.
 *
 * The results come from the same `/search/api` endpoint the search room uses, so the ranking a
 * reader sees here is the ranking they get on the results page, and the guardrails and rate
 * limits are the endpoint's rather than a second implementation's.
 *
 * The Atlas keeps its palette: there, a record selection also has to move the map, which is a
 * behaviour this component deliberately does not know about.
 */
'use client';

import React, { useCallback } from 'react';
import { TypeaheadCombobox, type TypeaheadSuggestion } from '../typeahead/TypeaheadCombobox';

void React;

export type CommandBarSearchProps = {
  /** Reads as a promise the surface can keep: the count is only shown where it is known. */
  readonly placeholder: string;
};

type SearchApiResult = {
  readonly id?: unknown;
  readonly displayName?: unknown;
  readonly kind?: unknown;
  readonly matchedText?: unknown;
};

/**
 * The search index keys records as `releaseId:entityId`, and the entity route is keyed by the
 * entity id alone. `/records` rows already link with the trailing segment, so this matches them
 * rather than inventing a second convention.
 */
function entityHrefFrom(id: string): string {
  const entityId = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id;
  return `/entity/${entityId}`;
}

export function CommandBarSearch({ placeholder }: CommandBarSearchProps) {
  const suggestRemote = useCallback(
    async (query: string): Promise<readonly TypeaheadSuggestion[]> => {
      const response = await fetch(`/search/api?q=${encodeURIComponent(query)}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        return [];
      }
      const payload: unknown = await response.json();
      const results =
        typeof payload === 'object' &&
        payload !== null &&
        Array.isArray((payload as { results?: unknown }).results)
          ? (payload as { results: readonly SearchApiResult[] }).results
          : [];

      return results.flatMap((result) => {
        if (typeof result.id !== 'string' || typeof result.displayName !== 'string') {
          return [];
        }
        return [
          {
            id: result.id,
            primary: result.displayName,
            ...(typeof result.kind === 'string' ? { secondary: result.kind } : {}),
            href: entityHrefFrom(result.id),
          },
        ];
      });
    },
    [],
  );

  return (
    <TypeaheadCombobox
      id="bar-search"
      name="q"
      label="Search records, places and eras"
      hideLabel
      placeholder={placeholder}
      className="ds-bar__search ds-bar__search--live"
      inputClassName="ds-bar__search-input"
      listLabel="Matching records"
      listClassName="ds-bar__search-list"
      minChars={2}
      suggestRemote={suggestRemote}
    />
  );
}
