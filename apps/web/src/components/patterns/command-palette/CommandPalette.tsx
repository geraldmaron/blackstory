/**
 * Command palette — the search-first way into 4,078 records, and the reason the v6 header could
 * drop from fourteen destinations to three zones.
 *
 * Three sections over one flat cursor: records, state jumps, and the keyboard layer from
 * `command-registry.ts`. Arrow keys walk the whole list, not each section, because a reader
 * pressing down four times does not think in sections.
 *
 * **A11y model.** A `dialog` wrapping a combobox: focus never leaves the input, and the active
 * row is named by `aria-activedescendant` rather than focused. That is what lets the reader keep
 * typing while the selection moves, and it makes the focus trap trivial — there is only ever one
 * focusable element inside, so Tab has nowhere to escape to.
 *
 * **Matching is not reimplemented here.** Ranking comes from `lib/typeahead/match.ts`, the same
 * tiering the address typeahead and book suggester use. What this module adds is where to draw the
 * `<mark>`, which is presentation, not a second matcher.
 *
 * See docs/ui/design-direction-v9-atlas.md §7 and docs/ui/patterns-atlas-instrument.md.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@repo/ui';
import { isTypingTarget, matchesPaletteOpen } from '../../../lib/keyboard/bindings';
import { normalizeTypeaheadQuery, typeaheadMatchTier } from '../../../lib/typeahead/match';
import { COMMANDS, type Command, type CommandContext } from './command-registry';
import './command-palette.css';

void React;

/** Records shown at once. The palette is a way in, not a results list — that is the rail's job. */
const MAX_RECORD_ROWS = 7;
const MAX_STATE_ROWS = 4;

/**
 * One record in the palette's client index.
 *
 * Name and place were the whole index until repo-92n2.35. A reader who types a subject rather
 * than a proper noun — "restrictive covenant", "Great Migration" — knows what happened without
 * knowing what any single record is called, and against a name/place index that reader got an
 * empty palette. The four subject fields below are indexed but not all displayed: what a row
 * shows is `place`, plus the field the match actually landed in when that was something else.
 */
export type PaletteRecord = {
  readonly id: string;
  readonly name: string;
  /** "Birmingham, Alabama". Shown as the row's second line. */
  readonly place: string;
  /** Human topic labels, not slugs: a query reads "restrictive covenant", never the id. */
  readonly topics?: readonly string[];
  /** "School", "Massacre" — the same label the record mark paints. */
  readonly kindLabel?: string;
  /** "1920s". Matches a reader who searches a decade instead of a name. */
  readonly eraLabel?: string;
  /** The record's one-line story. Last-resort field, and the widest one. */
  readonly summary?: string;
};

export type PaletteState = {
  readonly name: string;
};

/**
 * A site destination. The v9 bar carries two modes instead of fourteen links, so this section is
 * what keeps Data, Law, Memorial, Methodology, Corrections, Errata and Submit
 * reachable from Explore. Collapsing the nav without it would strand those rooms.
 */
export type PaletteDestination = {
  readonly href: string;
  readonly label: string;
};

export type CommandPaletteProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly records: readonly PaletteRecord[];
  readonly states: readonly PaletteState[];
  readonly destinations?: readonly PaletteDestination[];
  /** Handlers every registry command dispatches into. */
  readonly context: CommandContext;
  /** `fly` is true when the reader held ⌘ on enter: open the record and take the camera there. */
  readonly onOpenRecord: (record: PaletteRecord, fly: boolean) => void;
  readonly onJumpToState: (state: PaletteState) => void;
  readonly onNavigate?: (destination: PaletteDestination) => void;
  readonly className?: string;
};

type Row =
  | { readonly kind: 'record'; readonly key: string; readonly ranked: RankedPaletteRecord }
  | { readonly kind: 'state'; readonly key: string; readonly state: PaletteState }
  | { readonly kind: 'action'; readonly key: string; readonly command: Command }
  | {
      readonly kind: 'destination';
      readonly key: string;
      readonly destination: PaletteDestination;
    };

const SECTION_TITLES = {
  record: 'Records',
  state: 'Jump to state',
  destination: 'Go to',
  action: 'Actions',
} as const;

/**
 * Where the query lands inside the text, for the `<mark>`. Returns null when the normalised query
 * cannot be located verbatim — a query whose internal whitespace was collapsed, for instance.
 * A missing highlight is a cosmetic loss; a wrong one is a lie about why the row matched.
 */
function matchRange(text: string, query: string): readonly [number, number] | null {
  const needle = normalizeTypeaheadQuery(query);
  if (needle.length < 2) return null;

  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return null;
  return [index, index + needle.length];
}

function Highlighted({ text, query }: { readonly text: string; readonly query: string }) {
  const range = matchRange(text, query);
  if (!range) return <>{text}</>;

  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="ds-palette__mark">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/**
 * The palette's own opening binding. It stays a separate listener because `⌘K` has to work before
 * any other binding is reachable, but the chords themselves come from the keyboard layer so the
 * palette and the shortcut sheet cannot disagree about what opens the palette.
 */
export function useCommandPaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesPaletteOpen(event)) return;
      // `/` is also a character the reader may have meant to type. `⌘K` is not, so it opens the
      // palette from anywhere, including out of a focused search field.
      const bareSlash = event.key === '/';
      if (bareSlash && isTypingTarget(event.target)) return;

      event.preventDefault();
      onOpen();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
}

/**
 * Which field a row matched on, and the text that matched.
 *
 * Carried out of ranking rather than recomputed at render because the row has to be able to say
 * why it is there. A record surfaced by its summary, showing nothing but its place, reads as a
 * ranking mistake to the reader who typed a subject — the one field that explains the row is the
 * one field not on screen.
 */
export type RankedPaletteRecord = {
  readonly record: PaletteRecord;
  readonly matchedField: 'name' | 'place' | 'topic' | 'kind' | 'era' | 'summary';
  readonly matchedText: string;
};

/**
 * Penalties, in tier points, against a name match.
 *
 * Ordering is the claim, not the exact numbers. A name match always outranks every subject match,
 * because a reader typing a proper noun wants that record and nothing near it. Below the name,
 * place first (a query is more often a where than a what), then topic — the controlled vocabulary,
 * so a hit there is a real subject hit — then kind and era, which are coarse buckets that would
 * otherwise return half the archive, then summary, the widest and least deliberate field.
 *
 * The gaps are larger than the 20 points separating an exact match (100) from a substring (80),
 * so no substring hit in a lower field can climb over an exact hit in a higher one.
 */
const FIELD_PENALTY = {
  name: 0,
  place: 15,
  topic: 30,
  kind: 45,
  era: 45,
  summary: 60,
} as const;

function bestFieldMatch(record: PaletteRecord, query: string): RankedPaletteRecord | null {
  const candidates: readonly {
    readonly field: RankedPaletteRecord['matchedField'];
    readonly text: string | undefined;
  }[] = [
    { field: 'name', text: record.name },
    { field: 'place', text: record.place },
    ...(record.topics ?? []).map(
      (topic) => ({ field: 'topic', text: topic }) as { field: 'topic'; text: string },
    ),
    { field: 'kind', text: record.kindLabel },
    { field: 'era', text: record.eraLabel },
    { field: 'summary', text: record.summary },
  ];

  let best: { entry: RankedPaletteRecord; tier: number } | null = null;
  for (const candidate of candidates) {
    if (!candidate.text) continue;
    const tier = typeaheadMatchTier(query, candidate.text) - FIELD_PENALTY[candidate.field];
    if (tier <= 0) continue;
    if (best && tier <= best.tier) continue;
    best = {
      tier,
      entry: { record, matchedField: candidate.field, matchedText: candidate.text },
    };
  }
  return best ? best.entry : null;
}

export function rankRecords(
  records: readonly PaletteRecord[],
  query: string,
): readonly RankedPaletteRecord[] {
  const ranked: { entry: RankedPaletteRecord; tier: number }[] = [];

  for (const record of records) {
    const entry = bestFieldMatch(record, query);
    if (!entry) continue;
    ranked.push({
      entry,
      tier: typeaheadMatchTier(query, entry.matchedText) - FIELD_PENALTY[entry.matchedField],
    });
  }

  ranked.sort((a, b) => b.tier - a.tier || a.entry.record.name.length - b.entry.record.name.length);
  return ranked.slice(0, MAX_RECORD_ROWS).map((item) => item.entry);
}

export function CommandPalette({
  open,
  onClose,
  records,
  states,
  destinations = [],
  context,
  onOpenRecord,
  onJumpToState,
  onNavigate,
  className,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const rows = useMemo<readonly Row[]>(() => {
    const matchedRecords = query ? rankRecords(records, query) : [];
    const matchedStates = query
      ? states.filter((state) => typeaheadMatchTier(query, state.name) > 0).slice(0, MAX_STATE_ROWS)
      : [];
    const matchedActions = query
      ? COMMANDS.filter((command) => typeaheadMatchTier(query, command.title) > 0)
      : COMMANDS;
    // Destinations show only on a query. Listing every route in the resting palette would
    // reinstate the fourteen-item menu v9 removed, one layer deeper.
    const matchedDestinations = query
      ? destinations.filter((entry) => typeaheadMatchTier(query, entry.label) > 0)
      : [];

    return [
      ...matchedRecords.map((ranked): Row => ({
        kind: 'record',
        key: `r:${ranked.record.id}`,
        ranked,
      })),
      ...matchedStates.map((state): Row => ({ kind: 'state', key: `s:${state.name}`, state })),
      ...matchedDestinations.map((destination): Row => ({
        kind: 'destination',
        key: `d:${destination.href}`,
        destination,
      })),
      ...matchedActions.map((command): Row => ({
        kind: 'action',
        key: `a:${command.id}`,
        command,
      })),
    ];
  }, [destinations, query, records, states]);

  // Remember the trigger before the dialog steals focus, and reset the query so reopening the
  // palette is a fresh start rather than a return to whatever was typed last time.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.focus();

    return () => {
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  // The cursor must never point past the end after the query narrows the list.
  useEffect(() => {
    setActiveIndex((current) => (current < rows.length ? current : 0));
  }, [rows.length]);

  const activate = useCallback(
    (row: Row, fly: boolean) => {
      if (row.kind === 'record') onOpenRecord(row.ranked.record, fly);
      else if (row.kind === 'state') onJumpToState(row.state);
      else if (row.kind === 'destination') {
        if (onNavigate) onNavigate(row.destination);
        else window.location.assign(row.destination.href);
      } else row.command.run(context);

      onClose();
    },
    [context, onClose, onJumpToState, onNavigate, onOpenRecord],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      // Only one focusable element lives in here, so Tab has nowhere legitimate to go.
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }

      if (rows.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % rows.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + rows.length) % rows.length);
        return;
      }

      if (event.key === 'Enter') {
        const row = rows[activeIndex];
        if (!row) return;
        event.preventDefault();
        activate(row, event.metaKey || event.ctrlKey);
      }
    },
    [activate, activeIndex, onClose, rows],
  );

  if (!open) return null;

  const activeRowId = rows[activeIndex] ? `ds-palette-row-${rows[activeIndex].key}` : undefined;
  let renderedSection: Row['kind'] | null = null;

  return (
    <div className={cx('ds-palette', className)}>
      {/* Clicking away is the mouse equivalent of ESC. Not a focusable control: ESC and the
          listbox are the keyboard paths, and a tabbable backdrop would break the trap. */}
      <div className="ds-palette__scrim" onClick={onClose} aria-hidden="true" />

      <div
        className="ds-palette__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="ds-palette__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="ds-palette-listbox"
          aria-autocomplete="list"
          {...(activeRowId ? { 'aria-activedescendant': activeRowId } : {})}
          placeholder="Search records, jump to a state, run a command"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />

        <ul
          className="ds-palette__list"
          id="ds-palette-listbox"
          role="listbox"
          aria-label="Results"
        >
          {rows.map((row, index) => {
            const heading = row.kind !== renderedSection ? SECTION_TITLES[row.kind] : null;
            renderedSection = row.kind;

            return (
              <React.Fragment key={row.key}>
                {heading ? (
                  <li className="ds-palette__section" role="presentation">
                    {heading}
                  </li>
                ) : null}

                <li
                  id={`ds-palette-row-${row.key}`}
                  className={cx(
                    'ds-palette__row',
                    index === activeIndex && 'ds-palette__row--active',
                  )}
                  role="option"
                  aria-selected={index === activeIndex}
                  // The section headings are presentational, so the listbox cannot count its own
                  // options. Without these a reader hears "1 of 3" on a list of twenty.
                  aria-setsize={rows.length}
                  aria-posinset={index + 1}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={(event) => activate(row, event.metaKey || event.ctrlKey)}
                >
                  {row.kind === 'record' ? (
                    <>
                      <span className="ds-palette__title">
                        <Highlighted text={row.ranked.record.name} query={query} />
                      </span>
                      <span className="ds-palette__meta">
                        <Highlighted text={row.ranked.record.place} query={query} />
                        {/* The matched field, when it is one the row does not already show.
                            A subject match with only a place under it looks like a ranking
                            mistake to the reader who typed the subject. */}
                        {row.ranked.matchedField !== 'name' &&
                        row.ranked.matchedField !== 'place' ? (
                          <span className="ds-palette__reason">
                            {' · '}
                            <Highlighted text={row.ranked.matchedText} query={query} />
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}

                  {row.kind === 'state' ? (
                    <span className="ds-palette__title">
                      <Highlighted text={row.state.name} query={query} />
                    </span>
                  ) : null}

                  {row.kind === 'destination' ? (
                    <>
                      <span className="ds-palette__title">
                        <Highlighted text={row.destination.label} query={query} />
                      </span>
                      <span className="ds-palette__meta">{row.destination.href}</span>
                    </>
                  ) : null}

                  {row.kind === 'action' ? (
                    <>
                      <span className="ds-palette__title">
                        <Highlighted text={row.command.title} query={query} />
                      </span>
                      <span className="ds-palette__keys" aria-hidden="true">
                        {row.command.keys.map((key, keyIndex) => (
                          <kbd key={`${row.key}-${keyIndex}`} className="ds-palette__kbd">
                            {key}
                          </kbd>
                        ))}
                      </span>
                    </>
                  ) : null}
                </li>
              </React.Fragment>
            );
          })}

          {rows.length === 0 ? (
            <li className="ds-palette__empty" role="presentation">
              Nothing matches that. Try a place, a person, or a decade.
            </li>
          ) : null}
        </ul>

        <footer className="ds-palette__footer">
          <span className="ds-palette__legend" aria-hidden="true">
            <kbd className="ds-palette__kbd">↑</kbd>
            <kbd className="ds-palette__kbd">↓</kbd> navigate
            <kbd className="ds-palette__kbd">↵</kbd> open
            <kbd className="ds-palette__kbd">⌘</kbd>
            <kbd className="ds-palette__kbd">↵</kbd> open and fly
            <kbd className="ds-palette__kbd">ESC</kbd> close
          </span>
          <span className="ds-palette__count">
            {records.length.toLocaleString('en-US')} records indexed
          </span>
        </footer>
      </div>
    </div>
  );
}
