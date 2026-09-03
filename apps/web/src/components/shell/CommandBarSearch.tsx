/**
 * The bar's search, as a real search.
 *
 * Off Explore this slot used to be an anchor to /records: it looked exactly like Explore's
 * search field, in the same place, at the same size, and typing into it was impossible because
 * it was a link. On twelve of the thirteen rooms the only way to search was to navigate away
 * first. This makes it a live combobox instead, so a reader types where the search box is and
 * sees matching records under the cursor.
 *
 * The results come from the same `/search/api` endpoint the search room uses, so the ranking a
 * reader sees here is the ranking they get on the results page, and the guardrails and rate
 * limits are the endpoint's rather than a second implementation's.
 *
 * Explore keeps its palette: there, a record selection also has to move the map, which is a
 * behavior this component deliberately does not know about.
 *
 * It does own `⌘K` and `/` off Explore, and that is not a convenience. The palette's own opener
 * lives inside `CommandPalette`, which only Explore mounts, so on the other twelve rooms the
 * shortcut the bar advertises did nothing at all — including on the root error boundary, where a
 * thrown segment leaves search as the only way out of the page. The handler below is deliberately
 * a shell-level listener rather than something a room opts into, because the room is exactly what
 * is not rendering when it matters most.
 */
'use client';

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isTypingTarget, matchesPaletteOpen } from '../../lib/keyboard/bindings';
import {
  getPaletteSeed,
  getServerPaletteSeed,
  subscribeToPaletteSeed,
} from '../../lib/shell/palette-seed';
import { TypeaheadCombobox, type TypeaheadSuggestion } from '../typeahead/TypeaheadCombobox';
import { instrumentRecordHref } from '../../lib/place/place-slug';

void React;

/** The input's id, and the handle the shortcut handler focuses it by. */
const BAR_SEARCH_INPUT_ID = 'bar-search';

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
 * entity id alone. Standable kinds open Place; people and statutes go to those rooms.
 */
function recordHrefFrom(id: string, kind: string | undefined, displayName: string): string {
  const entityId = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id;
  return instrumentRecordHref({
    id: entityId,
    displayName,
    kind: kind ?? 'place',
  });
}

export function CommandBarSearch({ placeholder }: CommandBarSearchProps) {
  const seed = useSyncExternalStore(subscribeToPaletteSeed, getPaletteSeed, getServerPaletteSeed);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesPaletteOpen(event)) return;
      // `/` is a character before it is a shortcut. Yielding to whatever the reader is already
      // typing into is what keeps this from firing inside the correction form's own fields.
      if (isTypingTarget(event.target)) return;
      const input = document.getElementById(BAR_SEARCH_INPUT_ID);
      if (!(input instanceof HTMLInputElement)) return;
      // Without preventDefault a bare `/` lands in the field it just focused, and the reader's
      // first real keystroke arrives after a slash they did not type.
      event.preventDefault();
      input.focus();
      // Select rather than clear: on the 404 the field already holds the seeded path, and a
      // reader who wants to replace it types over the selection while one who wants to edit it
      // presses an arrow key. Clearing would throw away the only guess the surface has.
      input.select();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
            href: recordHrefFrom(
              result.id,
              typeof result.kind === 'string' ? result.kind : undefined,
              result.displayName,
            ),
          },
        ];
      });
    },
    [],
  );

  return (
    <TypeaheadCombobox
      /* The seed arrives from a client effect on the 404, after this component has already
         mounted holding an empty field, and `defaultValue` is read once. Keying on the seed
         remounts the combobox so the new default takes — which is also what discards it again
         when the reader navigates off the 404 and the seed clears. */
      key={seed}
      defaultValue={seed}
      id={BAR_SEARCH_INPUT_ID}
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
