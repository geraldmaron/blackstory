/**
 * Collections drawer — the saved list, z 90.
 *
 * Export is a first-class action here, not an afterthought. A reader who has assembled twelve
 * records has done research, and research that cannot leave the page is a demo
 * (design-direction-v9-atlas.md §7).
 *
 * `Copy as GeoJSON` reports how many saved records had no publishable point, because silently
 * exporting eleven of twelve would misrepresent the reader's own list.
 */
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cx } from '@repo/ui';
import { useFocusTrap } from '../../lib/keyboard/use-focus-trap';
import {
  toGeoJson,
  unmappableCount,
  type SavedCollection,
  type SavedRecord,
} from '../../lib/collections/store';
import { KindGlyph } from '../map-experience/KindGlyph';
import './collections-drawer.css';

void React;

export type CollectionsDrawerProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly collection: SavedCollection;
  readonly onOpenRecord?: (record: SavedRecord) => void;
  readonly onRemove?: (id: string) => void;
  readonly onClear?: () => void;
  /** Both copy actions hand the text back so the caller owns the clipboard and the toast. */
  readonly onCopyCitations?: (text: string) => void;
  readonly onCopyGeoJson?: (text: string, unmappable: number) => void;
  /** One citation per saved record, in list order. Built by the caller with the accessed date. */
  readonly citations?: readonly string[];
  readonly className?: string;
};

export function CollectionsDrawer({
  open,
  onClose,
  collection,
  onOpenRecord,
  onRemove,
  onClear,
  onCopyCitations,
  onCopyGeoJson,
  citations,
  className,
}: CollectionsDrawerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  useFocusTrap(dialogRef, open, { overlayRef });

  const close = useCallback(() => onClose(), [onClose]);

  /**
   * Callers pass `onClose` as an inline arrow, so `close` is a new function every render. Keeping
   * it in the effect's dependency list made the effect re-run on every render — re-capturing
   * `restoreTo` from whatever was focused *inside* the open drawer, and pulling focus back to the
   * dialog container mid-interaction. The listener therefore reads the callback through a ref and
   * the effect depends on `open` alone, so open and close are the only two things that move focus.
   */
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    restoreTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // Restored in cleanup, not in the click handler: at click time the drawer is still mounted
      // and React unmounts it immediately after, which drops focus to <body> and undoes the move.
      restoreTo.current?.focus();
      restoreTo.current = null;
    };
  }, [open]);

  if (!open) return null;

  const count = collection.records.length;
  const unmappable = unmappableCount(collection);

  return (
    <div className={cx('ds-saved', className)} ref={overlayRef}>
      <button type="button" className="ds-saved__scrim" aria-label="Close saved" onClick={close} />
      <div
        className="ds-saved__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ds-saved-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="ds-saved__head">
          <h2 className="ds-saved__title" id="ds-saved-title">
            Saved
          </h2>
          <span className="ds-saved__meta">
            {count === 1 ? '1 record' : `${count.toLocaleString('en-US')} records`}
          </span>
          <button
            type="button"
            className="ds-saved__close"
            onClick={close}
            aria-label="Close saved"
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

        <div className="ds-saved__body">
          {count === 0 ? (
            <p className="ds-saved__empty">
              Nothing saved yet. Press <kbd className="ds-kbd">S</kbd> on a record, or use the
              bookmark on any row in the results rail, and it will collect here for citing and
              export.
            </p>
          ) : (
            <ul className="ds-saved__list">
              {collection.records.map((record) => (
                <li key={record.id} className="ds-saved__row">
                  <KindGlyph kind={record.kind} size={13} className="ds-saved__glyph" />
                  <span className="ds-saved__text">
                    {onOpenRecord ? (
                      <button
                        type="button"
                        className="ds-saved__name"
                        onClick={() => onOpenRecord(record)}
                      >
                        {record.name}
                      </button>
                    ) : (
                      <a className="ds-saved__name" href={record.href}>
                        {record.name}
                      </a>
                    )}
                    <span className="ds-saved__rowmeta">
                      {[record.place, record.era, record.grade ? `Grade ${record.grade}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {onRemove ? (
                    <button
                      type="button"
                      className="ds-saved__remove"
                      onClick={() => onRemove(record.id)}
                      aria-label={`Remove ${record.name} from saved`}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3.5 3.5l9 9m0-9-9 9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {count > 0 ? (
          <footer className="ds-saved__foot">
            {onCopyCitations ? (
              <button
                type="button"
                className="ds-saved__action"
                onClick={() => onCopyCitations((citations ?? []).join('\n'))}
              >
                Copy all citations
              </button>
            ) : null}
            {onCopyGeoJson ? (
              <button
                type="button"
                className="ds-saved__action"
                onClick={() =>
                  onCopyGeoJson(JSON.stringify(toGeoJson(collection), null, 2), unmappable)
                }
              >
                Copy as GeoJSON
              </button>
            ) : null}
            {onClear ? (
              <button
                type="button"
                className="ds-saved__action ds-saved__action--quiet"
                onClick={onClear}
              >
                Clear list
              </button>
            ) : null}
            {unmappable > 0 ? (
              <p className="ds-saved__note">
                {unmappable === 1
                  ? '1 saved record has no published point and is left out of the GeoJSON.'
                  : `${unmappable} saved records have no published point and are left out of the GeoJSON.`}
              </p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
