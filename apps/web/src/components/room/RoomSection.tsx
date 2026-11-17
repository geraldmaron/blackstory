/**
 * A room's sections: a plain h2 (the shared SectionHeading) and its content. No icon plate, no
 * kicker, no alternating bands; the heading carries the section.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { cx, SectionHeading } from '@repo/ui';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { BandRule, type BandArtMotif } from '../atmosphere/BandArt';

void React;

export type RoomSectionProps = {
  readonly id: string;
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  /** A drawn rule over the heading (About's quilt row). Decorative. */
  readonly rule?: BandArtMotif;
};

export function RoomSection({ id, title, children, className, rule }: RoomSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} className={cx('ds-room-section', className)} aria-labelledby={headingId}>
      {rule ? <BandRule motif={rule} className="ds-room-section__rule" /> : null}
      <SectionHeading id={headingId}>{title}</SectionHeading>
      {children}
    </section>
  );
}

export type RoomFact = {
  readonly title: string;
  readonly body: ReactNode;
};

/** Ruled rows of a short title and its sentence. */
export function RoomFactList({
  items,
  className,
}: {
  readonly items: readonly RoomFact[];
  readonly className?: string;
}) {
  return (
    <ul className={cx('ds-room-facts', className)}>
      {items.map((item) => (
        <li key={item.title} className="ds-room-fact">
          <h3 className="ds-room-fact__title">{item.title}</h3>
          <div className="ds-room-fact__body">{item.body}</div>
        </li>
      ))}
    </ul>
  );
}

export type RoomHandoffProps = {
  readonly href: string;
  readonly icon: DestinationIconId;
  readonly title: string;
  readonly line: string;
};

/** A related room, drawn as a ruled link row so it cannot hide inside a paragraph. */
export function RoomHandoff({ href, icon, title, line }: RoomHandoffProps) {
  return (
    <Link className="ds-room-handoff" href={href}>
      <span className="ds-room-handoff__plate" aria-hidden="true">
        <DestinationIcon id={icon} size="lg" />
      </span>
      <span className="ds-room-handoff__copy">
        <strong>{title}</strong>
        <small>{line}</small>
      </span>
    </Link>
  );
}
