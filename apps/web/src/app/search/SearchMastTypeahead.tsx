/**
 * Archive search mast typeahead — fetches `/search/api?suggest=1` while typing and
 * navigates to the entity record on pick. Enter without a highlighted option submits
 * the surrounding GET form.
 */
'use client';

import React, { useCallback } from 'react';
import { getRequestIntegrityHeaders } from '../../lib/request-integrity/client.js';
import {
  TypeaheadCombobox,
  type TypeaheadSuggestion,
} from '../../components/typeahead/TypeaheadCombobox.js';

type SuggestApiRow = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly href: string;
};

export type SearchMastTypeaheadProps = {
  readonly defaultValue: string;
};

export function SearchMastTypeahead({ defaultValue }: SearchMastTypeaheadProps) {
  const suggestRemote = useCallback(async (query: string): Promise<readonly TypeaheadSuggestion[]> => {
    const integrity = await getRequestIntegrityHeaders();
    const response = await fetch(
      `/search/api?suggest=1&q=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          ...integrity,
        },
      },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as { readonly suggestions?: readonly SuggestApiRow[] };
    if (!Array.isArray(body.suggestions)) return [];
    return body.suggestions.map((row) => ({
      id: row.id,
      primary: row.displayName,
      secondary: row.kind,
      href: row.href,
    }));
  }, []);

  return (
    <TypeaheadCombobox
      id="q"
      name="q"
      label="Search the archive"
      hideLabel
      placeholder="A school, a church, a city…"
      defaultValue={defaultValue}
      className="ds-typeahead ds-typeahead--mast"
      inputClassName="ds-search-mast__input"
      listLabel="Suggested records"
      suggestRemote={suggestRemote}
    />
  );
}
