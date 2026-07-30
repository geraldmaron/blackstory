/**
 * Shortcut sheet — four columns: Find, Camera, Records, View.
 *
 * It renders `command-registry.ts` plus the two global chords from the keyboard layer. It holds no
 * shortcut list of its own, which is the point: a sheet that is hand-maintained is a sheet that
 * lies about the keyboard within a release or two.
 *
 * Design law: docs/ui/design-direction-v9-atlas.md §7.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { cx } from '@repo/ui';
import {
  COMMAND_SECTIONS,
  COMMANDS,
  type CommandSection,
  type KeyChord,
} from './command-palette/command-registry';
import { GLOBAL_BINDINGS } from '../../lib/keyboard/bindings';
import './shortcut-sheet.css';

void React;

export type ShortcutSheetProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly className?: string;
};

type SheetRow = { readonly id: string; readonly title: string; readonly keys: KeyChord };

/** Globals first inside their column: the palette is how a reader reaches everything else. */
function rowsFor(section: CommandSection): readonly SheetRow[] {
  return [
    ...GLOBAL_BINDINGS.filter((binding) => binding.section === section),
    ...COMMANDS.filter((command) => command.section === section),
  ].map(({ id, title, keys }) => ({ id, title, keys }));
}

function Keys({ keys }: { readonly keys: KeyChord }) {
  return (
    <>
      {keys.map((cap, index) => (
        <kbd key={`${cap}-${index}`} className="ds-kbd">
          {cap}
        </kbd>
      ))}
    </>
  );
}

export function ShortcutSheet({ open, onClose, className }: ShortcutSheetProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const columns = useMemo(
    () => COMMAND_SECTIONS.map((section) => [section, rowsFor(section)] as const),
    [],
  );

  const close = useCallback(() => {
    onClose();
    // Focus goes back where it came from. A reader who opened the sheet from the bar and lands on
    // <body> afterwards has lost their place in the tab order.
    restoreTo.current?.focus();
    restoreTo.current = null;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  if (!open) return null;

  return (
    <div className={cx('ds-shortcuts', className)}>
      <button
        type="button"
        className="ds-shortcuts__scrim"
        aria-label="Close keyboard shortcuts"
        onClick={close}
      />
      <div
        className="ds-shortcuts__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ds-shortcuts-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="ds-shortcuts__head">
          <h2 className="ds-shortcuts__title" id="ds-shortcuts-title">
            Keyboard
          </h2>
          <span className="ds-shortcuts__hint">
            Press <kbd className="ds-kbd">?</kbd> anytime
          </span>
          <button
            type="button"
            className="ds-shortcuts__close"
            onClick={close}
            aria-label="Close keyboard shortcuts"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.8 3.8l8.4 8.4m0-8.4-8.4 8.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="ds-shortcuts__body">
          {columns.map(([section, rows]) => (
            <section key={section} className="ds-shortcuts__column">
              <h3 className="ds-shortcuts__section">{section}</h3>
              <dl className="ds-shortcuts__list">
                {rows.map((row) => (
                  <div key={row.id} className="ds-shortcuts__row">
                    <dt className="ds-shortcuts__label">{row.title}</dt>
                    <dd className="ds-shortcuts__keys">
                      <Keys keys={row.keys} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
