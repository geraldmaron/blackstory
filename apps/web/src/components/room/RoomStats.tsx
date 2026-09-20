/**
 * The numbers a room can state honestly, set as display numerals in a ruled row under the
 * masthead. These sat in a 10px mono colophon line ("12 law entries · 4 federal statutes"), which
 * is where a room's most concrete facts went to be skipped.
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
  readonly label: string;
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
    <dl className={cx('ds-room-stats', className)} aria-label={label}>
      {stats.map((stat) => (
        <div className="ds-room-stats__item" key={stat.label}>
          {/* The label is the term and the figure its value, but the figure reads first. */}
          <dt className="ds-room-stats__label">{stat.label}</dt>
          <dd
            className="ds-room-stats__value"
            data-phrase={typeof stat.value === 'string' ? '' : undefined}
          >
            {typeof stat.value === 'number' ? stat.value.toLocaleString('en-US') : stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
