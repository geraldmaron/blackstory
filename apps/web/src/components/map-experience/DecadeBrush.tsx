/**
 * The decade histogram: one slim brushable strip that owns "when" on the map.
 *
 * Bars are documented decades (`collection-period.ts`), never event years. Neutral at rest; drag
 * across them to brush a range, which draws in ink with copper handles. A click picks one decade,
 * the handles nudge either edge (pointer or arrow keys), and the x clears it. The From and To
 * selects set the same range without a drag (WCAG 2.5.7). The draft range
 * follows the pointer; the filter commits on release, so a drag across the archive does not
 * re-filter thousands of records on every frame.
 */
'use client';

import React, { useCallback, useRef, useState } from 'react';
import { buttonClassName, cx } from '@repo/ui';
import type { DecadeBar } from '../../lib/map-experience/decade-density';
import { MapKey } from './MapKey';
import './decade-brush.css';

void React;

export type DecadeRange = { readonly start: number; readonly end: number };

export type DecadeBrushProps = {
  readonly bars: readonly DecadeBar[];
  /** The brushed range as decade starts, or null for no range. */
  readonly range: DecadeRange | null;
  readonly onChange: (range: DecadeRange | null) => void;
  readonly className?: string;
};

/** Index of the bar under a horizontal position, clamped to the track. Pure, for the test. */
export function barIndexAt(x: number, left: number, width: number, count: number): number {
  if (count === 0 || width <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(((x - left) / width) * count)));
}

/** The range two bar indices span, in either order. */
export function rangeBetween(bars: readonly DecadeBar[], a: number, b: number): DecadeRange | null {
  const from = bars[Math.min(a, b)];
  const to = bars[Math.max(a, b)];
  return from && to ? { start: from.decade, end: to.decade } : null;
}

/** "1860s to 1940s". The column's echo of the range uses the same words. */
export function decadeRangeLabel(range: DecadeRange): string {
  return range.start === range.end ? `${range.start}s` : `${range.start}s to ${range.end}s`;
}

/** A range that spans every bar is no range: it would only drop the undated records. */
export function committedRange(
  bars: readonly DecadeBar[],
  next: DecadeRange | null,
): DecadeRange | null {
  const whole = next !== null && next.start === bars[0]?.decade && next.end === bars.at(-1)?.decade;
  return whole ? null : next;
}

/**
 * The range a From or To choice makes. With no range the other end rests on the archive's own
 * end, as the handles do; a choice past the other end brings that end along with it.
 */
export function rangeWithEnd(
  bars: readonly DecadeBar[],
  range: DecadeRange | null,
  edge: 'start' | 'end',
  decade: number,
): DecadeRange {
  const start = range?.start ?? bars[0]?.decade ?? decade;
  const end = range?.end ?? bars.at(-1)?.decade ?? decade;
  return edge === 'start'
    ? { start: decade, end: Math.max(decade, end) }
    : { start: Math.min(decade, start), end: decade };
}

type Drag =
  | { readonly kind: 'brush'; readonly anchor: number; readonly moved: boolean }
  | { readonly kind: 'edge'; readonly edge: 'start' | 'end' };

export function DecadeBrush({ bars, range, onChange, className }: DecadeBrushProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<DecadeRange | null>(null);
  const shown = draft ?? range;

  const indexOf = useCallback(
    (decade: number) => bars.findIndex((bar) => bar.decade === decade),
    [bars],
  );
  const active = shown !== null && indexOf(shown.start) >= 0 && indexOf(shown.end) >= 0;
  // With no range the handles rest on the archive's two ends, so the keyboard can start one.
  const startIndex = active ? indexOf(shown!.start) : 0;
  const endIndex = active ? indexOf(shown!.end) : bars.length - 1;
  const commit = useCallback(
    (next: DecadeRange | null) => onChange(committedRange(bars, next)),
    [bars, onChange],
  );

  const indexAt = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      return rect ? barIndexAt(clientX, rect.left, rect.width, bars.length) : 0;
    },
    [bars.length],
  );

  const onTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (bars.length === 0 || event.button !== 0) return;
    const anchor = indexAt(event.clientX);
    dragRef.current = { kind: 'brush', anchor, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(rangeBetween(bars, anchor, anchor));
  };

  const onHandlePointerDown =
    (edge: 'start' | 'end') => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      dragRef.current = { kind: 'edge', edge };
      trackRef.current?.setPointerCapture(event.pointerId);
      setDraft(rangeBetween(bars, startIndex, endIndex));
    };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const index = indexAt(event.clientX);
    if (drag.kind === 'brush') {
      if (index !== drag.anchor) dragRef.current = { ...drag, moved: true };
      setDraft(rangeBetween(bars, drag.anchor, index));
      return;
    }
    setDraft(rangeBetween(bars, drag.edge === 'start' ? endIndex : startIndex, index));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const next = draft;
    setDraft(null);
    if (!drag || !next) return;
    // A plain click on the one decade already picked lets it go.
    if (
      drag.kind === 'brush' &&
      !drag.moved &&
      range &&
      range.start === next.start &&
      range.end === next.end
    ) {
      onChange(null);
      return;
    }
    commit(next);
  };

  const onHandleKeyDown = (edge: 'start' | 'end') => (event: React.KeyboardEvent) => {
    if (bars.length === 0) return;
    const step =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : 0;
    const jump = event.key === 'Home' ? -bars.length : event.key === 'End' ? bars.length : 0;
    if (step === 0 && jump === 0) return;
    event.preventDefault();
    const moving = edge === 'start' ? startIndex : endIndex;
    const fixed = edge === 'start' ? endIndex : startIndex;
    const target = Math.min(bars.length - 1, Math.max(0, moving + step + jump));
    // An edge never crosses the other one; it stops on it.
    const bounded = edge === 'start' ? Math.min(target, fixed) : Math.max(target, fixed);
    commit(rangeBetween(bars, bounded, fixed));
  };

  const first = bars[0];
  const last = bars.at(-1);
  const percent = (index: number) => (bars.length > 0 ? (index / bars.length) * 100 : 0);

  return (
    <section
      className={cx('ds-xbrush', active && 'ds-xbrush--active', className)}
      aria-label="Documented decades"
    >
      <div className="ds-xbrush__lead">
        <div className="ds-xbrush__label">
          {active && shown ? (
            <>
              <span className="ds-xbrush__range" aria-live="polite">
                {decadeRangeLabel(shown)}
              </span>
              <button
                type="button"
                className="ds-xbrush__clear"
                onClick={() => onChange(null)}
                aria-label="Clear the decade range"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="m4.5 4.5 7 7m0-7-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <span className="ds-xbrush__range ds-xbrush__range--all">All decades</span>
          )}
        </div>
        <MapKey className="ds-xbrush__key" />
      </div>

      <div className="ds-xbrush__plot">
        <div
          ref={trackRef}
          className="ds-xbrush__track"
          onPointerDown={onTrackPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {bars.map((bar, index) => (
            <span
              key={bar.decade}
              className={cx(
                'ds-xbrush__bar',
                active && index >= startIndex && index <= endIndex && 'ds-xbrush__bar--in',
              )}
              style={{ height: `${bar.heightPercent}%` }}
              title={`${bar.label} · ${bar.count.toLocaleString('en-US')} ${bar.count === 1 ? 'record' : 'records'}`}
            />
          ))}
          {active ? (
            <span
              className="ds-xbrush__span"
              aria-hidden="true"
              style={{
                left: `${percent(startIndex)}%`,
                width: `${percent(endIndex + 1) - percent(startIndex)}%`,
              }}
            />
          ) : null}
          {bars.length > 0
            ? (['start', 'end'] as const).map((edge) => {
                const index = edge === 'start' ? startIndex : endIndex + 1;
                const decade = bars[edge === 'start' ? startIndex : endIndex]!.decade;
                return (
                  <button
                    key={edge}
                    type="button"
                    role="slider"
                    className={`ds-xbrush__handle ds-xbrush__handle--${edge}`}
                    style={{ left: `${percent(index)}%` }}
                    aria-label={edge === 'start' ? 'Earliest decade' : 'Latest decade'}
                    aria-valuemin={first?.decade ?? 0}
                    aria-valuemax={last?.decade ?? 0}
                    aria-valuenow={decade}
                    aria-valuetext={`${decade}s`}
                    onPointerDown={onHandlePointerDown(edge)}
                    onKeyDown={onHandleKeyDown(edge)}
                  />
                );
              })
            : null}
        </div>
        {first && last ? (
          <div className="ds-xbrush__axis" aria-hidden="true">
            <span>{first.label}</span>
            <span>{last.label}</span>
          </div>
        ) : null}
      </div>

      {first && last ? (
        <div className="ds-xbrush__ends">
          {(['start', 'end'] as const).map((edge) => (
            <label key={edge} className="ds-xbrush__end">
              <span className="ds-xbrush__end-label">{edge === 'start' ? 'From' : 'To'}</span>
              <select
                className={buttonClassName('secondary', 'ds-xbrush__select')}
                value={
                  (edge === 'start' ? range?.start : range?.end) ??
                  (edge === 'start' ? first : last).decade
                }
                onChange={(event) =>
                  commit(rangeWithEnd(bars, range, edge, Number(event.currentTarget.value)))
                }
              >
                {bars.map((bar) => (
                  <option key={bar.decade} value={bar.decade}>
                    {bar.decade}s
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
