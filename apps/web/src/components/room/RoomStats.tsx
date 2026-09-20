/**
 * The numbers a room can state honestly, set as display numerals in a ruled row under the
 * masthead. These sat in a 10px mono colophon line ("12 law entries · 4 federal statutes"), which
 * is where a room's most concrete facts went to be skipped.
 *
 * One primitive for a count ("12 law entries") and for a sourced figure ("12.3% of the country
 * counted Black in the 2020 census · U.S. Census Bureau"). /data's opening figures were the first
 * version of this and now render through it.
 *
 * Rules (docs/ui/design-direction-v10-rooms.md): only a number already true on the page, never a
 * score, never on the memorial wall (P-01). Facts with no number stay in `DocumentColophon`.
 */
import React from 'react';
import { cx } from '@repo/ui';

void React;

export type RoomStat = {
  /** A count, or a short phrase where the honest answer is not a number ("A few days"). */
  readonly value: number | string;
  /** "%", "×", "pts". Set smaller, after the figure. */
  readonly unit?: string | undefined;
  readonly label: string;
  /** Who published the figure. With a source the label reads as a sentence, not a mono tag. */
  readonly source?: string | undefined;
  /** Where on the page the figure is shown with its working. */
  readonly href?: string | undefined;
  readonly id?: string | undefined;
};

export type RoomStatsProps = {
  readonly stats: readonly RoomStat[];
  /** Names the group for assistive tech: "The catalog at a glance". */
  readonly label: string;
  readonly className?: string;
};

export function RoomStats({ stats, label, className }: RoomStatsProps) {
  if (stats.length === 0) return null;
  return (
    <ul className={cx('ds-room-stats', className)} aria-label={label}>
      {stats.map((stat) => {
        const body = (
          <>
            <span
              className="ds-room-stats__value"
              data-phrase={
                typeof stat.value === 'string' && !/\d/.test(stat.value) ? '' : undefined
              }
            >
              {typeof stat.value === 'number' ? stat.value.toLocaleString('en-US') : stat.value}
              {stat.unit ? <span className="ds-room-stats__unit">{stat.unit}</span> : null}
            </span>
            <span
              className={cx(
                'ds-room-stats__label',
                stat.source !== undefined && 'ds-room-stats__label--sentence',
              )}
            >
              {stat.label}
            </span>
            {stat.source === undefined ? null : (
              <span className="ds-room-stats__source">{stat.source}</span>
            )}
          </>
        );
        return (
          <li className="ds-room-stats__item" key={stat.id ?? stat.label}>
            {stat.href === undefined ? (
              body
            ) : (
              <a className="ds-room-stats__link" href={stat.href}>
                {body}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
