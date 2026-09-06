/**
 * The evidence blocks: SourceList, Connections, TrustBlock, Anatomy, Precision and Note.
 *
 * These are the parts of a room that say how much it knows and how it knows it. Two rules
 * from the design law are enforced by the markup rather than left to a caller:
 * a Connection states the relation in words and never renders a bare arrow, and a Precision
 * line always says what the coordinate does *not* claim.
 *
 * Precision's stylesheet travels with it. The rest of these blocks are only ever drawn inside a
 * room, which loads the kit; Precision is also drawn on the map surface, which loads no room
 * stylesheet, so relying on the route to have imported the kit left it unstyled there.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';
import './precision.css';

void React;

/* —— SourceList ————————————————————————————————————————————————————————————— */

export type RoomSource = {
  /** The source string as it should be cited, publisher first. */
  readonly text: string;
  /** Year of the source, not of the event. */
  readonly year?: string;
  readonly href?: string;
};

export type SourceListProps = {
  readonly sources: readonly RoomSource[];
  readonly className?: string;
};

export function SourceList({ sources, className }: SourceListProps) {
  return (
    <ol className={cx('ds-room-srcs', className)}>
      {sources.map((source, index) => (
        <li className="ds-room-src" key={`${index}-${source.text}`}>
          <span className="ds-room-src__i" aria-hidden="true">
            {index + 1}
          </span>
          <span className="ds-room-src__t">
            {source.href ? (
              <a href={source.href} rel="noreferrer">
                {source.text}
              </a>
            ) : (
              source.text
            )}
          </span>
          <span className="ds-room-src__y">{source.year ?? '—'}</span>
        </li>
      ))}
    </ol>
  );
}

/* —— Connections ———————————————————————————————————————————————————————————— */

export type RoomConnection = {
  readonly name: string;
  /** The relation, in words: "cited by", "same place as", "successor statute". */
  readonly relation: string;
  readonly href: string;
};

export type ConnectionsProps = {
  readonly connections: readonly RoomConnection[];
  readonly className?: string;
};

export function Connections({ connections, className }: ConnectionsProps) {
  return (
    <ul className={cx('ds-room-conns', className)}>
      {connections.map((connection, index) => (
        <li key={`${index}-${connection.href}`}>
          <a className="ds-room-conn" href={connection.href}>
            <span className="ds-room-conn__name">{connection.name}</span>
            <span className="ds-room-conn__rel">{connection.relation}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* —— TrustBlock ————————————————————————————————————————————————————————————— */

export type TrustFact = {
  readonly label: string;
  readonly value: ReactNode;
};

export type TrustBlockProps = {
  readonly facts: readonly TrustFact[];
  /** Names the block for screen readers; the visible label is the grid itself. */
  readonly label?: string;
  readonly className?: string;
};

export function TrustBlock({ facts, label = 'Evidence', className }: TrustBlockProps) {
  return (
    <div className={cx('ds-room-trust', className)} role="group" aria-label={label}>
      {facts.map((fact) => (
        <div className="ds-room-trust__row" key={fact.label}>
          <span className="ds-room-trust__k">{fact.label}</span>
          <span className="ds-room-trust__v">{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

/* —— Anatomy ———————————————————————————————————————————————————————————————— */

export type AnatomyCell = {
  readonly label: string;
  readonly value: ReactNode;
  readonly icon?: ReactNode;
};

export type AnatomyProps = {
  readonly cells: readonly AnatomyCell[];
  readonly label?: string;
  readonly className?: string;
};

export function Anatomy({ cells, label = 'Record anatomy', className }: AnatomyProps) {
  return (
    <div className={cx('ds-room-anat', className)} role="group" aria-label={label}>
      {cells.map((cell) => (
        <div className="ds-room-anat__cell" key={cell.label}>
          <span className="ds-room-anat__k">
            {cell.icon ? <span aria-hidden="true">{cell.icon}</span> : null}
            {cell.label}
          </span>
          <span className="ds-room-anat__v">{cell.value}</span>
        </div>
      ))}
    </div>
  );
}

/* —— Precision ——————————————————————————————————————————————————————————————— */

export type PrecisionProps = {
  /** What the coordinate resolves to: "county centroid", "street address", "block". */
  readonly resolution: string;
  /** What it does not claim. Required: an unqualified pin is the failure this block exists for. */
  readonly caveat: string;
  readonly className?: string;
};

export function Precision({ resolution, caveat, className }: PrecisionProps) {
  return (
    <p className={cx('ds-room-precision', className)}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      </svg>
      <span>
        Located to {resolution}. {caveat}
      </span>
    </p>
  );
}

/* —— Note ——————————————————————————————————————————————————————————————————— */

export type NoteProps = {
  /** Mono caps prefix — "SERIES", "SCOPE", "CAUTION". */
  readonly kind?: string;
  readonly children: ReactNode;
  readonly className?: string;
};

export function Note({ kind, children, className }: NoteProps) {
  return (
    <p className={cx('ds-room-note', className)}>
      {kind ? <>{kind} · </> : null}
      {children}
    </p>
  );
}
