/**
 * Room — the column every Reading, Record and Utility surface renders inside.
 *
 * The measure comes from the surface class attribute that `ShellPageTransition` already emits
 * on the page root, so a room never sets its own width. That is deliberate: twelve edition
 * stylesheets each picking a max-width is how three surface classes ended up looking like
 * twenty-one.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

export type RoomProps = {
  readonly children: ReactNode;
  readonly className?: string;
  /** Overrides the `<main>` element id. Skip-link target; defaults to the shell's `main`. */
  readonly id?: string;
};

export function Room({ children, className, id = 'main' }: RoomProps) {
  return (
    <main className={cx('ds-room', className)} id={id}>
      <div className="ds-room__doc">{children}</div>
    </main>
  );
}
