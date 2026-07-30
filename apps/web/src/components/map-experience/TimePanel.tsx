/**
 * Time panel: one control owns "when".
 *
 * Replaces v6's horizontally scrolling decade-tab rail, which required scrolling to see the shape
 * of the archive. A density histogram shows that shape at a glance and is still a real slider:
 * `role="slider"` with a live `aria-valuetext`, arrow-key stepping, and pointer-capture scrub.
 *
 * Carried forward from v6 and still binding: a decade view shows status **as-of that decade**
 * from published status history, never present-day status backfilled.
 *
 * See docs/ui/design-direction-v9-atlas.md §5.4.
 */
'use client';

import React, { useCallback, useRef } from 'react';
import { cx } from '@repo/ui';
import { decadeSubLine, type DecadeBar } from '../../lib/map-experience/decade-density';
import './time-panel.css';

void React;

/** Number of axis labels under the track. */
const AXIS_LABEL_COUNT = 6;

export type TimePanelProps = {
  readonly bars: readonly DecadeBar[];
  /** Selected decade start year, or null for all time. */
  readonly decade: number | null;
  readonly onDecadeChange: (decade: number | null) => void;
  readonly totalRecords: number;
  readonly playing?: boolean;
  readonly onTogglePlay?: () => void;
  readonly className?: string;
};

function axisLabels(bars: readonly DecadeBar[]): readonly string[] {
  if (bars.length === 0) return [];
  if (bars.length <= AXIS_LABEL_COUNT) return bars.map((bar) => bar.label);

  const step = (bars.length - 1) / (AXIS_LABEL_COUNT - 1);
  return Array.from({ length: AXIS_LABEL_COUNT }, (_, index) => {
    const bar = bars[Math.round(index * step)];
    return bar ? bar.label : '';
  });
}

export function TimePanel({
  bars,
  decade,
  onDecadeChange,
  totalRecords,
  playing = false,
  onTogglePlay,
  className,
}: TimePanelProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const activeIndex = decade === null ? -1 : bars.findIndex((bar) => bar.decade === decade);
  const activeBar = activeIndex >= 0 ? (bars[activeIndex] ?? null) : null;
  const first = bars[0];
  const last = bars.at(-1);

  const pickAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || bars.length === 0) return;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = (clientX - rect.left) / rect.width;
      const index = Math.min(bars.length - 1, Math.max(0, Math.floor(ratio * bars.length)));
      const bar = bars[index];
      if (bar && bar.decade !== decade) onDecadeChange(bar.decade);
    },
    [bars, decade, onDecadeChange],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      pickAt(event.clientX);
    },
    [pickAt],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragging.current) pickAt(event.clientX);
    },
    [pickAt],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (bars.length === 0) return;

      if (event.key === ' ' || event.key === 'Spacebar') {
        if (!onTogglePlay) return;
        event.preventDefault();
        onTogglePlay();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const next = bars[Math.min(bars.length - 1, activeIndex + 1)];
        if (next) onDecadeChange(next.decade);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        // Stepping left off the first decade returns to all time rather than sticking.
        if (activeIndex <= 0) onDecadeChange(null);
        else onDecadeChange(bars[activeIndex - 1]!.decade);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        if (first) onDecadeChange(first.decade);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        if (last) onDecadeChange(last.decade);
      }
    },
    [activeIndex, bars, first, last, onDecadeChange, onTogglePlay],
  );

  const playheadPercent =
    activeIndex >= 0 && bars.length > 0 ? ((activeIndex + 0.5) / bars.length) * 100 : 0;

  return (
    <section className={cx('ds-time-panel', className)} aria-label="When">
      <header className="ds-time-panel__header">
        <span className="ds-time-panel__kicker">When</span>
        <span className="ds-time-panel__current">{activeBar ? activeBar.label : 'All time'}</span>
        <span className="ds-time-panel__sub">{decadeSubLine(activeBar, totalRecords)}</span>

        <div className="ds-time-panel__controls">
          {onTogglePlay ? (
            <button
              type="button"
              className="ds-time-panel__play"
              onClick={onTogglePlay}
              aria-pressed={playing}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          ) : null}
          <button
            type="button"
            className="ds-time-panel__alltime"
            onClick={() => onDecadeChange(null)}
            disabled={decade === null}
          >
            All time
          </button>
        </div>
      </header>

      <div
        ref={trackRef}
        className="ds-time-panel__track"
        role="slider"
        tabIndex={0}
        aria-valuemin={first?.decade ?? 0}
        aria-valuemax={last?.decade ?? 0}
        aria-valuenow={activeBar?.decade ?? first?.decade ?? 0}
        aria-valuetext={
          activeBar
            ? `${activeBar.label}, ${decadeSubLine(activeBar, totalRecords)}`
            : `All time, ${totalRecords.toLocaleString('en-US')} records`
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {bars.map((bar) => (
          <div
            key={bar.decade}
            className={cx(
              'ds-time-panel__bar',
              decade === null && 'ds-time-panel__bar--inrange',
              bar.decade === decade && 'ds-time-panel__bar--active',
              bar.count === 0 && 'ds-time-panel__bar--empty',
            )}
            style={{ height: `${bar.heightPercent}%` }}
            title={`${bar.label} · ${bar.count} ${bar.count === 1 ? 'record' : 'records'}`}
          />
        ))}

        <div
          className="ds-time-panel__playhead"
          style={{ left: `${playheadPercent}%`, opacity: activeBar ? 1 : 0 }}
          aria-hidden="true"
        />
      </div>

      <ol className="ds-time-panel__axis" aria-hidden="true">
        {axisLabels(bars).map((label, index) => (
          <li key={`${label}-${index}`}>{label}</li>
        ))}
      </ol>
    </section>
  );
}
