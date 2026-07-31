/**
 * HairlineIndex — the archive read as a list, not a map.
 *
 * This is the block behind the epic's first binding correction: a map answers "what happened
 * near here" well and "what is documented about X" badly, so the archive keeps a browsable
 * non-spatial index at its own crawlable URL. Rows are links for that reason.
 *
 * Filter chips, a count line, then rows carrying kind glyph, name, place, era and a grade dot.
 *
 * This is the one block in the kit that is a client component: the chip bar is interactive, so
 * a server room that renders the index passes rows and counts and leaves `onFilterChange` off.
 * The rows themselves stay plain anchors, which is what keeps the index crawlable.
 */

'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

export type IndexFilter = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
};

export type IndexRow = {
  readonly href: string;
  readonly name: string;
  readonly place: string;
  readonly era: string;
  /** Kind glyph, drawn by the caller so the index does not own an icon registry. */
  readonly glyph?: ReactNode;
  /** Evidence grade, rendered as the trailing dot. */
  readonly grade?: ReactNode;
};

export type HairlineIndexProps = {
  readonly filters?: readonly IndexFilter[];
  readonly activeFilterId?: string | undefined;
  readonly onFilterChange?: ((id: string) => void) | undefined;
  readonly rows: readonly IndexRow[];
  /** Count line above the list. Written out so it can say "of 1,204 shown". */
  readonly countLabel: string;
  /** Rendered instead of the list when `rows` is empty. */
  readonly empty?: ReactNode;
  readonly className?: string;
};

export function HairlineIndex({
  filters,
  activeFilterId,
  onFilterChange,
  rows,
  countLabel,
  empty,
  className,
}: HairlineIndexProps) {
  return (
    <div className={cx('ds-room-idx', className)}>
      {filters && filters.length > 0 ? (
        <div className="ds-room-idx__bar" role="group" aria-label="Filter the index">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="ds-room-chip"
              aria-pressed={filter.id === activeFilterId}
              onClick={() => onFilterChange?.(filter.id)}
            >
              {filter.label} <span className="ds-room-num">{filter.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="ds-room-idx__count">{countLabel}</p>

      {rows.length === 0 ? (
        empty
      ) : (
        <div className="ds-room-idx__list">
          {rows.map((row, index) => (
            <a className="ds-room-idx__row" href={row.href} key={`${index}-${row.href}`}>
              <span className="ds-room-idx__glyph" aria-hidden="true">
                {row.glyph}
              </span>
              <span className="ds-room-idx__name">{row.name}</span>
              <span className="ds-room-idx__place">{row.place}</span>
              <span className="ds-room-idx__era">{row.era}</span>
              <span className="ds-room-idx__grade">{row.grade}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
