/**
 * GroupHeading, CardGrid and RoomCard — the catalogue block shared by every room that lists
 * things: chapters, books, laws, datasets, the rooms hub.
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
   * `'index'` (default): one column, each RoomCard a hairline row. `'hub'`: three fixed columns.
   *
   * `/rooms` used the hub shape and no longer does. Three columns of five destinations reads
   * as a card wall, and a hub's reader is choosing a room rather than scanning a catalogue of
   * like things; one column of five reads as a table of contents, which is what a hub is. The
   * variant stays on the surface because a genuinely wide, flat set may still want it.
   */
  readonly variant?: 'index' | 'hub';
  readonly className?: string;
};

export function CardGrid({ children, variant = 'index', className }: CardGridProps) {
  return (
    <div className={cx('ds-room-cards', variant === 'hub' && 'ds-room-cards--hub', className)}>
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
  /**
   * Right-hand tag on an index row: what sort of room this is ("Long form",
   * "Reference", "Receipt"). Distinct from `kind`, which stopped printing per-card because a
   * three-up card had no room for it: a full-width row does, on the far side of the title.
   */
  readonly tag?: string;
  /** Hero image, above the title. */
  readonly media?: RoomCardMedia;
  readonly className?: string;
};

export function RoomCard({
  href,
  kind,
  title,
  description,
  meta,
  tag,
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
      {tag ? <span className="ds-room-card__tag">{tag}</span> : null}
      {meta ? <span className="ds-room-card__meta">{meta}</span> : null}
    </Link>
  );
}
