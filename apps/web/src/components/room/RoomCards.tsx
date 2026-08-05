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

/**
 * A card's hero image. Optional, and only for catalogues whose entries are authored with one:
 * a chapter has a hero, a law does not. `alt` is required rather than optional because a
 * catalogue of images with no alt text is a catalogue a screen reader cannot browse.
 */
export type RoomCardMedia = {
  readonly url: string;
  readonly alt: string;
};

export type RoomCardProps = {
  readonly href: string;
  /** Mono caps kind tag: what sort of thing this is. */
  readonly kind: string;
  readonly title: ReactNode;
  /** One line. Two lines is a summary, and a card is not a summary. */
  readonly description?: ReactNode;
  /** Mono footer facts — year, count, jurisdiction. Rendered as written. */
  readonly meta?: string;
  /** Hero image, bled to the card's edges above the kind tag. */
  readonly media?: RoomCardMedia;
  readonly className?: string;
};

export function RoomCard({
  href,
  kind,
  title,
  description,
  meta,
  media,
  className,
}: RoomCardProps) {
  return (
    <Link className={cx('ds-room-card', media && 'ds-room-card--media', className)} href={href}>
      {media ? (
        <span className="ds-room-card__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt={media.alt} loading="lazy" />
        </span>
      ) : null}
      <span className="ds-room-card__kind">{kind}</span>
      <h3 className="ds-room-card__title">{title}</h3>
      {description ? <p className="ds-room-card__desc">{description}</p> : null}
      {meta ? <span className="ds-room-card__meta">{meta}</span> : null}
    </Link>
  );
}
