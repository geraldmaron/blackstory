/**
 * GroupHeading, CardGrid and RoomCard — the catalogue block shared by every room that lists
 * things: chapters, books, laws, datasets, the library hub.
 *
 * A RoomCard is a link, not a button with an onClick: a catalogue entry is a destination and
 * has to be openable in a new tab, copyable and crawlable.
 */

import React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';

void React;

export type GroupHeadingProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function GroupHeading({ children, className }: GroupHeadingProps) {
  return <h2 className={cx('ds-room-grouphd', className)}>{children}</h2>;
}

export type CardGridProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function CardGrid({ children, className }: CardGridProps) {
  return <div className={cx('ds-room-cards', className)}>{children}</div>;
}

export type RoomCardProps = {
  readonly href: string;
  /** Mono caps kind tag: what sort of thing this is. */
  readonly kind: string;
  readonly title: ReactNode;
  /** One line. Two lines is a summary, and a card is not a summary. */
  readonly description?: ReactNode;
  /** Mono footer facts — year, count, jurisdiction. Rendered as written. */
  readonly meta?: string;
  readonly className?: string;
};

export function RoomCard({ href, kind, title, description, meta, className }: RoomCardProps) {
  return (
    <Link className={cx('ds-room-card', className)} href={href}>
      <span className="ds-room-card__kind">{kind}</span>
      <h3 className="ds-room-card__title">{title}</h3>
      {description ? <p className="ds-room-card__desc">{description}</p> : null}
      {meta ? <span className="ds-room-card__meta">{meta}</span> : null}
    </Link>
  );
}
