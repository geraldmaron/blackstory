/**
 * Standalone-room chapter breaks: a visible icon plate, a heading, and an optional sunk band.
 *
 * The v9 reading-room law kept long rooms as one hairline column with 0.72em muted kickers.
 * That made Methodology, About, FAQ and Sources scan as the same undifferentiated stack, and
 * left source-library content with no visual weight. These blocks keep the prose measure and
 * add the chapter identity the column was missing. Not cards: no radius lift, no copper fill.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { cx } from '@repo/ui';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

export type RoomSectionTone = 'canvas' | 'sunk';

/** Alternate sunk and canvas so long rooms keep a chapter rhythm. First body section is sunk. */
export function roomSectionTone(index: number): RoomSectionTone {
  return index % 2 === 0 ? 'sunk' : 'canvas';
}

export type RoomSectionProps = {
  readonly id: string;
  readonly icon: DestinationIconId;
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly kicker?: string;
  readonly tone?: RoomSectionTone;
  readonly className?: string;
};

export function RoomSection({
  id,
  icon,
  title,
  children,
  kicker,
  tone = 'canvas',
  className,
}: RoomSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      className={cx('ds-room-section', tone === 'sunk' && 'ds-room-section--sunk', className)}
      aria-labelledby={headingId}
    >
      <header className="ds-room-section__head">
        <span className="ds-room-section__plate" aria-hidden="true">
          <DestinationIcon id={icon} size="lg" />
        </span>
        <div className="ds-room-section__titles">
          {kicker ? <p className="ds-room-section__kicker">{kicker}</p> : null}
          <h2 className="ds-room-section__title" id={headingId}>
            {title}
          </h2>
        </div>
      </header>
      <div className="ds-room-section__body">{children}</div>
    </section>
  );
}

export type RoomFact = {
  readonly title: string;
  readonly body: ReactNode;
  readonly icon?: DestinationIconId;
  readonly kicker?: string;
};

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
          {item.icon ? (
            <span className="ds-room-section__plate" aria-hidden="true">
              <DestinationIcon id={item.icon} size="lg" />
            </span>
          ) : null}
          <div className="ds-room-fact__copy">
            {item.kicker ? <p className="ds-room-fact__kicker">{item.kicker}</p> : null}
            <h3 className="ds-room-fact__title">{item.title}</h3>
            <div className="ds-room-fact__body">{item.body}</div>
          </div>
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

/** A related room, drawn as a plate-led row so it cannot hide inside a paragraph. */
export function RoomHandoff({ href, icon, title, line }: RoomHandoffProps) {
  return (
    <Link className="ds-room-handoff" href={href}>
      <span className="ds-room-section__plate" aria-hidden="true">
        <DestinationIcon id={icon} size="lg" />
      </span>
      <span className="ds-room-handoff__copy">
        <strong>{title}</strong>
        <small>{line}</small>
      </span>
    </Link>
  );
}
