/**
 * OffRamp, RecordNav and EmptyList — the three ways a room ends.
 *
 * OffRamp is mandatory at the foot of every reading room: "no reading room is a dead end" is
 * design law, and it is asserted in room-kit.test.tsx rather than left to a reviewer's memory.
 * EmptyList wraps the shared `EmptyState` primitive instead of forking it, and always names
 * /submit — an archive that shows nothing and asks for nothing teaches readers it is finished.
 */

import React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { EmptyState, cx } from '@repo/ui';

void React;

/* —— OffRamp ———————————————————————————————————————————————————————————————— */

export type OffRampAction = {
  readonly href: string;
  readonly label: string;
  /** One copper action per composition; every other action is quiet. */
  readonly emphasis?: 'copper' | 'quiet';
};

export type OffRampProps = {
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly actions: readonly OffRampAction[];
  readonly className?: string;
};

export function OffRamp({ title, children, actions, className }: OffRampProps) {
  return (
    <aside className={cx('ds-room-offramp', className)} aria-label="Where to go next">
      <h2 className="ds-room-offramp__title">{title}</h2>
      <p>{children}</p>
      <div className="ds-room-offramp__acts">
        {actions.map((action, index) => (
          <Link
            key={`${index}-${action.href}`}
            className={cx(
              'ds-cta',
              action.emphasis === 'copper' ? 'ds-cta--copper' : 'ds-cta--quiet',
            )}
            href={action.href}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

/* —— RecordNav —————————————————————————————————————————————————————————————— */

export type RecordNavTarget = {
  readonly href: string;
  readonly label: string;
};

export type RecordNavProps = {
  /** The record before this one in the session's order, if there is one. */
  readonly previous?: RecordNavTarget | undefined;
  readonly next?: RecordNavTarget | undefined;
  readonly className?: string;
};

export function RecordNav({ previous, next, className }: RecordNavProps) {
  if (!previous && !next) return null;

  return (
    <nav className={cx('ds-room-recnav', className)} aria-label="Records in this session">
      {previous ? (
        <Link className="ds-cta ds-cta--quiet" href={previous.href} rel="prev">
          ← {previous.label}
        </Link>
      ) : null}
      <span className="ds-room-recnav__sp" />
      {next ? (
        <Link className="ds-cta ds-cta--quiet" href={next.href} rel="next">
          {next.label} →
        </Link>
      ) : null}
    </nav>
  );
}

/* —— EmptyList —————————————————————————————————————————————————————————————— */

export type EmptyListProps = {
  readonly title: string;
  /** What was searched for and came back with nothing. */
  readonly children: ReactNode;
  readonly className?: string;
};

export function EmptyList({ title, children, className }: EmptyListProps) {
  return (
    <EmptyState
      className={cx('ds-room-emptylist', className)}
      title={title}
      action={
        <Link className="ds-cta ds-cta--quiet" href="/submit">
          Submit a record
        </Link>
      }
    >
      {children}
    </EmptyState>
  );
}
