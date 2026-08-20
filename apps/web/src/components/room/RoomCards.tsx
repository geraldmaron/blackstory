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
  /**
   * `'index'` (default): one column, each RoomCard a hairline row — the shape a catalogue like
   * `/about` or `/support` lists reads as. `'hub'`: three fixed columns — `/library` only, the
   * one surface the registry calls a hub rather than an index.
   */
  readonly variant?: 'index' | 'hub';
  readonly className?: string;
};

export function CardGrid({ children, variant = 'index', className }: CardGridProps) {
  return (
    <div
      className={cx('ds-room-cards', variant === 'hub' && 'ds-room-cards--hub', className)}
    >
      {children}
    </div>
  );
}

/**
 * A card's hero image. Optional, and only for catalogues whose entries are authored with one:
 * a chapter has a hero, a law does not. `alt` is required rather than optional because a
 * catalogue of images with no alt text is a catalogue a screen reader cannot browse.
 */
export type RoomCardMedia = {
  readonly url: string;
  readonly alt: string;
  /**
   * How the image fills its slot. `cover` (default) fills the box and crops, which is right
   * for a hero whose subject is the whole frame — a map, a streetscape. `contain` fits the
   * whole image inside the box, which is right when the subject must not be cut: a gallery
   * of portraits has no crop origin that works for both a full-length painting and a tight
   * bust, so cropping either beheads one or clips the forehead off the other.
   */
  readonly fit?: 'cover' | 'contain';
};

export type RoomCardProps = {
  readonly href: string;
  /**
   * What sort of thing this is. Ink direction: no longer rendered as a kind tag — kind is
   * implied by the group the card sits in — but kept on the type so the existing callers do
   * not have to change in the same commit.
   */
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
  void kind;
  return (
    <Link className={cx('ds-room-card', media && 'ds-room-card--media', className)} href={href}>
      {media ? (
        <span
          className={cx(
            'ds-room-card__media',
            media.fit === 'contain' && 'ds-room-card__media--contain',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt={media.alt} loading="lazy" />
        </span>
      ) : null}
      <h3 className="ds-room-card__title">{title}</h3>
      {description ? <p className="ds-room-card__desc">{description}</p> : null}
      {meta ? <span className="ds-room-card__meta">{meta}</span> : null}
    </Link>
  );
}
