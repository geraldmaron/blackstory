/**
 * Three entry postures for BlackStory rooms. The only legal way a room may open
 * (plan.md decision, Phase 2). RoomHeader is gone.
 *
 * Field  — no header; the room opens in the world (map, memorial plate).
 * Record — the place identity is the header (mast, evidence strip).
 * Reading — editorial masthead: title + optional lede; no kicker, no mono meta row.
 *           Citation facts move to DocumentColophon at the foot.
 *
 * surface-parity.test.ts forbids a fourth posture inventing its own header vocabulary.
 */

import React from 'react';
import type { ReactNode } from 'react';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { cx } from '@repo/ui';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { Breadcrumb } from './Breadcrumb';

void React;

export type EntryPosture = 'field' | 'record' | 'reading';

export type ReadingEntryProps = {
  readonly pathname: string;
  readonly crumbLabel?: string;
  readonly title: ReactNode;
  /** One serif sentence. Optional: many reading rooms need only the title. */
  readonly lede?: ReactNode;
  readonly className?: string;
  /** Show the quiet breadcrumb trail. Off for top-level doors whose crumb equals the title. */
  readonly showCrumb?: boolean;
  /** A `DocumentPlate` set into the masthead. Ledger reading rooms only; utility rooms have none. */
  readonly plate?: ReactNode;
};

/**
 * Reading posture: editorial masthead. No kicker restating the title, no mono meta strip.
 * Put counts and release labels in {@link DocumentColophon}.
 */
export function ReadingEntry({
  pathname,
  crumbLabel,
  title,
  lede,
  className,
  showCrumb = true,
  plate,
}: ReadingEntryProps) {
  return (
    <header
      className={cx(
        'ds-entry ds-entry--reading',
        plate !== undefined && plate !== null && 'ds-entry--plated',
        className,
      )}
      data-posture="reading"
    >
      {showCrumb ? <Breadcrumb pathname={pathname} hereLabel={crumbLabel} /> : null}
      <h1 className="ds-entry__title">{title}</h1>
      {lede ? <p className="ds-entry__lede">{lede}</p> : null}
      {plate}
    </header>
  );
}

export type DocumentColophonProps = {
  readonly facts: readonly string[];
  readonly className?: string;
};

/** Mono citation facts that used to live in RoomHeader's meta row. */
export function DocumentColophon({ facts, className }: DocumentColophonProps) {
  if (facts.length === 0) return null;
  return (
    <footer className={cx('ds-entry-colophon', className)} data-posture-colophon="">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </footer>
  );
}

export type OrientationMove = {
  readonly label: string;
  readonly href: string;
  readonly note?: string;
  readonly icon?: DestinationIconId;
};

export type OrientationInstrumentProps = {
  /** Where you are in the archive, in plain language. */
  readonly where: string;
  /** Era band or period the current set sits in, when known. */
  readonly eraBand?: string;
  /** Two or three authored next moves, not a facet dump. */
  readonly moves: readonly OrientationMove[];
  readonly className?: string;
};

/**
 * Replaces RoomRail facet-count lists as the Reading-room orientation instrument.
 * Answers: where you are, which era band, and a few next moves.
 */
export function OrientationInstrument({
  where,
  eraBand,
  moves,
  className,
}: OrientationInstrumentProps) {
  if (moves.length === 0 && !eraBand) {
    return (
      <aside className={cx('ds-orientation', className)} aria-label="Where you are">
        <p className="ds-orientation__where">{where}</p>
      </aside>
    );
  }

  return (
    <aside className={cx('ds-orientation', className)} aria-label="Where you are">
      <p className="ds-orientation__where">{where}</p>
      {eraBand ? <p className="ds-orientation__era">{eraBand}</p> : null}
      {moves.length > 0 ? (
        <ul className="ds-orientation__moves">
          {moves.map((move) => (
            <li key={move.href}>
              <a className="ds-orientation__link" href={move.href}>
                <span className="ds-orientation__label">
                  {move.icon ? (
                    <DestinationIcon id={move.icon} className="ds-kicker-glyph" />
                  ) : null}
                  {move.label}
                </span>
                {move.note ? <span className="ds-orientation__note">{move.note}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
