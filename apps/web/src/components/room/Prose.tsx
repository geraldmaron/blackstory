/**
 * Prose and RecordRef — the 66ch measure, hairline section rules, and the inline citation
 * chip that opens the record sheet without leaving the chapter.
 *
 * RecordRef is the mechanism behind "you can leave the prose at any point and go look at the
 * thing itself". It is a button, not a link, because it opens the sheet over the reading
 * position; the same record's durable URL is reachable from inside the sheet.
 */

/* No 'use client' here on purpose: neither component holds state, so the directive would
   force a boundary and make `onOpen` cross it as a non-serializable prop. RecordRef is only
   ever rendered inside a chapter body that is already a client component. */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

export type ProseProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function Prose({ children, className }: ProseProps) {
  return <div className={cx('ds-room-prose', className)}>{children}</div>;
}

export type RecordRefProps = {
  /** Record id the sheet opens on. */
  readonly recordId: string;
  /** Optional kind glyph rendered before the label. */
  readonly glyph?: ReactNode;
  readonly children: ReactNode;
  readonly onOpen: (recordId: string) => void;
  readonly className?: string;
};

export function RecordRef({ recordId, glyph, children, onOpen, className }: RecordRefProps) {
  return (
    <button
      type="button"
      className={cx('ds-room-rref', className)}
      onClick={() => onOpen(recordId)}
      aria-haspopup="dialog"
    >
      {glyph ? (
        <span className="ds-room-rref__glyph" aria-hidden="true">
          {glyph}
        </span>
      ) : null}
      {children}
    </button>
  );
}
