/**
 * The Explore column: the one panel on the map.
 *
 * Wide screens: a 380px plate floating one gutter in from the left, top and bottom. Phones: the same
 * element is a bottom sheet over a full-screen map, with three heights (peek shows the count and
 * the top row, half, full) that a drag on its top edge moves between. The header carries the only
 * record count on the page; what sits under it (filters and list, list, or the inspector) is the
 * caller's. The caller sets `--ds-xcol-detent-h` (from `sheetHeightFor`) on a shared ancestor,
 * so the map controls can ride on top of the sheet too.
 */
'use client';

import React, { useRef } from 'react';
import { cx } from '@repo/ui';
import './explore-column.css';

void React;

export type SheetDetent = 'peek' | 'half' | 'full';

/** The phone header above the sheet, and the tab bar under it (tab-bar.css). */
const PHONE_HEADER = 48;
const PHONE_TAB_BAR = 56;
/** Grab strip (44, a full touch target) + header (48) + one list row (104, see
 * RESULTS_ROW_HEIGHT): the count and the top record. explore-column.css and map-controls.css
 * carry the same 196px. */
export const SHEET_PEEK_HEIGHT = 196;

/** The sheet's own height at a detent, tab bar excluded. Pure, so layout and camera agree. */
export function sheetHeightFor(detent: SheetDetent, viewportHeight: number): number {
  const full = Math.max(SHEET_PEEK_HEIGHT, viewportHeight - PHONE_HEADER - PHONE_TAB_BAR - 8);
  if (detent === 'full') return full;
  if (detent === 'half')
    return Math.min(full, Math.max(SHEET_PEEK_HEIGHT, Math.round(viewportHeight * 0.5)));
  return SHEET_PEEK_HEIGHT;
}

/** How far up the viewport the sheet reaches: its height plus the tab bar under it. */
export function sheetReachFor(detent: SheetDetent, viewportHeight: number): number {
  return sheetHeightFor(detent, viewportHeight) + PHONE_TAB_BAR;
}

const ORDER: readonly SheetDetent[] = ['peek', 'half', 'full'];

/** A press of the grab bar (click, tap, Enter or Space) steps peek, half, full, then back to peek. */
export function nextDetent(current: SheetDetent): SheetDetent {
  return current === 'peek' ? 'half' : current === 'half' ? 'full' : 'peek';
}
/** A drag past this many pixels, or a flick faster than this (px per ms), moves one detent. */
const STEP_PX = 56;
const FLICK = 0.5;

/** Where a released drag lands. Up is negative `dy`. Long drags can skip a detent. */
export function detentAfterDrag(current: SheetDetent, dy: number, speed: number): SheetDetent {
  const index = ORDER.indexOf(current);
  const steps = Math.abs(dy) > STEP_PX * 3 ? 2 : Math.abs(dy) > STEP_PX || speed > FLICK ? 1 : 0;
  if (steps === 0 || Math.abs(dy) < 8) return current;
  const next = index + (dy < 0 ? steps : -steps);
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, next))]!;
}

export type ExploreColumnProps = {
  /** Phone layout: render as the bottom sheet. */
  readonly sheet: boolean;
  readonly detent: SheetDetent;
  readonly onDetentChange: (detent: SheetDetent) => void;
  readonly viewportHeight: number;
  readonly header: React.ReactNode;
  /** The always-visible place and record search, under the header (owner decision 2026-11-16). */
  readonly search?: React.ReactNode;
  /** Active-filter echoes, under the search. */
  readonly echoes?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly view: 'filters' | 'list' | 'inspector';
  readonly busy?: boolean;
};

export function ExploreColumn({
  sheet,
  detent,
  onDetentChange,
  viewportHeight,
  header,
  search,
  echoes,
  children,
  view,
  busy = false,
}: ExploreColumnProps) {
  const dragRef = useRef<{ y: number; t: number; id: number } | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  /** A drag that started on the grab bar must not also count as a press of it. */
  const draggedRef = useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheet || event.button !== 0) return;
    // Controls in the header keep their own clicks.
    if (
      (event.target as HTMLElement).closest('button:not(.ds-xcol__grab), a, input, select, label')
    )
      return;
    draggedRef.current = false;
    dragRef.current = { y: event.clientY, t: performance.now(), id: event.pointerId };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root) return;
    const dy = event.clientY - drag.y;
    if (!draggedRef.current) {
      if (Math.abs(dy) <= 8) return;
      // Captured only once this is a drag: capture retargets the click, and a press of the grab
      // bar must stay a press of the grab bar.
      draggedRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      root.setAttribute('data-dragging', 'true');
    }
    const base = sheetHeightFor(detent, viewportHeight);
    const height = Math.max(
      SHEET_PEEK_HEIGHT - 24,
      Math.min(sheetHeightFor('full', viewportHeight) + 24, base - dy),
    );
    root.style.setProperty('--ds-xcol-sheet-h', `${height}px`);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    rootRef.current?.removeAttribute('data-dragging');
    rootRef.current?.style.removeProperty('--ds-xcol-sheet-h');
    if (!drag || !draggedRef.current) return;
    const dy = event.clientY - drag.y;
    const speed = Math.abs(dy) / Math.max(1, performance.now() - drag.t);
    const next = detentAfterDrag(detent, dy, speed);
    if (next !== detent) onDetentChange(next);
  };

  return (
    <aside
      ref={rootRef}
      className={cx('ds-xcol', sheet && 'ds-xcol--sheet')}
      data-ground="ink"
      aria-label="Records on the map"
      aria-busy={busy || undefined}
      data-view={view}
      data-detent={sheet ? detent : undefined}
    >
      <div
        className="ds-xcol__top"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {sheet ? (
          <button
            type="button"
            className="ds-xcol__grab"
            aria-label={detent === 'full' ? 'Lower the panel' : 'Raise the panel'}
            onClick={(event) => {
              // A drag that ended over the bar is not a press of it. A keyboard press (detail 0)
              // always is.
              if (draggedRef.current && event.detail !== 0) {
                draggedRef.current = false;
                return;
              }
              draggedRef.current = false;
              onDetentChange(nextDetent(detent));
            }}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <div className="ds-xcol__head">{header}</div>
      </div>
      {search ? (
        <div
          className="ds-xcol__search"
          // On a phone the place field shows at peek. Using it needs room for its suggestions
          // and the keyboard, so focus raises the sheet.
          onFocusCapture={() => {
            if (sheet && detent === 'peek') onDetentChange('full');
          }}
        >
          {search}
        </div>
      ) : null}
      {echoes}
      <div className="ds-xcol__body">{children}</div>
    </aside>
  );
}
