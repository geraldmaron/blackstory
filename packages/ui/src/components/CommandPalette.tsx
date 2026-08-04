/**
 * Keyboard-first command palette — the primary navigator for operator surfaces.
 *
 * The shell nav can only hold a handful of destinations before it stops being scannable, but an
 * operator console legitimately has thirty. The palette is how the long tail stays reachable:
 * the nav carries the four or five places you live in, and everything else is one ⌘K away.
 * Ranking is deliberately boring — label prefix, then label substring, then anything else that
 * matches — because an operator typing "gray" wants /graylist first, every time, not a score.
 */

'use client';

import React, {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type CommandPaletteItem = {
  readonly id: string;
  readonly label: string;
  /** Section heading in the list, e.g. "Triage". Ungrouped items sort last. */
  readonly group?: string;
  /** Trailing muted text — a path, a shortcut, a count. */
  readonly hint?: string;
  /** Extra match terms that are not in the label ("submissions" for /inbox). */
  readonly keywords?: readonly string[];
};

export type CommandPaletteProps = {
  readonly open: boolean;
  readonly items: readonly CommandPaletteItem[];
  readonly onClose: () => void;
  readonly onSelect: (item: CommandPaletteItem) => void;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  /** Accessible name for the dialog. */
  readonly label?: string;
  readonly className?: string;
};

/** Rank buckets, lowest is best. Kept explicit so ordering is testable and predictable. */
const RANK_LABEL_PREFIX = 0;
const RANK_LABEL_WORD_PREFIX = 1;
const RANK_LABEL_SUBSTRING = 2;
const RANK_OTHER_SUBSTRING = 3;
const RANK_SUBSEQUENCE = 4;

function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return needle.length === 0;
}

function rankItem(item: CommandPaletteItem, query: string): number | null {
  const label = item.label.toLowerCase();
  if (label.startsWith(query)) return RANK_LABEL_PREFIX;
  if (label.split(/[^a-z0-9]+/).some((word) => word.length > 0 && word.startsWith(query))) {
    return RANK_LABEL_WORD_PREFIX;
  }
  if (label.includes(query)) return RANK_LABEL_SUBSTRING;

  const other = [item.group ?? '', item.hint ?? '', ...(item.keywords ?? [])]
    .join(' ')
    .toLowerCase();
  if (other.includes(query)) return RANK_OTHER_SUBSTRING;
  if (isSubsequence(query, label)) return RANK_SUBSEQUENCE;
  return null;
}

/**
 * Pure ranking used by the palette. Exported so navigation IA can be unit-tested without a DOM.
 * An empty query preserves the caller's order — that ordering is the curated default menu.
 */
export function filterCommandPaletteItems(
  items: readonly CommandPaletteItem[],
  query: string,
): readonly CommandPaletteItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return items;

  return items
    .map((item, index) => ({ item, index, rank: rankItem(item, normalized) }))
    .filter((entry): entry is { item: CommandPaletteItem; index: number; rank: number } =>
      entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

/** Groups results for rendering, preserving first-appearance order of both groups and items. */
export function groupCommandPaletteItems(
  items: readonly CommandPaletteItem[],
): readonly { readonly group: string | null; readonly items: readonly CommandPaletteItem[] }[] {
  const order: (string | null)[] = [];
  const buckets = new Map<string | null, CommandPaletteItem[]>();
  for (const item of items) {
    const key = item.group ?? null;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)?.push(item);
  }
  return order.map((group) => ({ group, items: buckets.get(group) ?? [] }));
}

/** True for the platform "open the palette" chord: ⌘K on Apple, Ctrl+K elsewhere. */
export function isCommandPaletteChord(event: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
}): boolean {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
}

/** Binds the ⌘K/Ctrl+K chord at the document level. */
export function useCommandPaletteHotkey(onOpen: () => void): void {
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (!isCommandPaletteChord(event)) return;
      event.preventDefault();
      onOpen();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onOpen]);
}

export function CommandPalette({
  open,
  items,
  onClose,
  onSelect,
  placeholder = 'Search or jump to…',
  emptyLabel = 'No matches',
  label = 'Command palette',
  className,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => filterCommandPaletteItems(items, query), [items, query]);
  const groups = useMemo(() => groupCommandPaletteItems(results), [results]);
  const active = results[Math.min(activeIndex, results.length - 1)];

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  // Any keystroke invalidates the previous highlight; the top result is always the safe default.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function move(delta: number) {
    if (results.length === 0) return;
    setActiveIndex((current) => {
      const next = current + delta;
      // Wrap: reaching the bottom and pressing Down again is a request for the top.
      return ((next % results.length) + results.length) % results.length;
    });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(results.length - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active) {
        onSelect(active);
        onClose();
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={cx('ds-command-palette', className)}
      aria-label={label}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicks land on the <dialog> itself only when they hit the backdrop.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="ds-command-palette__panel">
        <input
          ref={inputRef}
          type="text"
          className="ds-command-palette__input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={placeholder}
          {...(active ? { 'aria-activedescendant': `${listboxId}-${active.id}` } : {})}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <ul className="ds-command-palette__list" id={listboxId} role="listbox" aria-label={label}>
          {results.length === 0 ? (
            <li className="ds-command-palette__empty" role="presentation">
              {emptyLabel}
            </li>
          ) : (
            groups.map((section) => (
              <li key={section.group ?? '__ungrouped'} role="presentation">
                {section.group ? (
                  <p className="ds-command-palette__group">{section.group}</p>
                ) : null}
                <ul className="ds-command-palette__group-list" role="presentation">
                  {section.items.map((item) => (
                    <li
                      key={item.id}
                      id={`${listboxId}-${item.id}`}
                      role="option"
                      aria-selected={item.id === active?.id}
                      className={cx(
                        'ds-command-palette__option',
                        item.id === active?.id && 'is-active',
                      )}
                      // Pointer selection commits on mousedown so the input never loses focus first.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSelect(item);
                        onClose();
                      }}
                      onMouseEnter={() => {
                        const index = results.findIndex((candidate) => candidate.id === item.id);
                        if (index >= 0) setActiveIndex(index);
                      }}
                    >
                      <span className="ds-command-palette__option-label">{item.label}</span>
                      {item.hint ? (
                        <span className="ds-command-palette__option-hint">{item.hint}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  );
}
