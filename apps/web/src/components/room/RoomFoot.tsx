/**
 * RecordNav and EmptyList: the two ways a room ends besides simply ending.
 *
 * EmptyList wraps the shared `EmptyState` primitive instead of forking it, and always names
 * /submit — an archive that shows nothing and asks for nothing teaches readers it is finished.
 */

import React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { buttonClassName, EmptyState, cx } from '@repo/ui';

void React;

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
        <Link className={buttonClassName('quiet')} href={previous.href} rel="prev">
          ← {previous.label}
        </Link>
      ) : null}
      <span className="ds-room-recnav__sp" />
      {next ? (
        <Link className={buttonClassName('quiet')} href={next.href} rel="next">
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
        <Link className={buttonClassName('quiet')} href="/submit">
          Submit a record
        </Link>
      }
    >
      {children}
    </EmptyState>
  );
}
