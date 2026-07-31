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
  /**
   * Optional right rail, for the Reading rooms whose design law gives them one (`/records` by
   * era and state, `/chapters` by era and place, `/books` and `/law` by jurisdiction). It renders
   * AFTER the column in the document so the rail's grouping links never come before the thing
   * they group; the grid places it alongside on wide viewports and below on narrow.
   */
  readonly rail?: ReactNode;
};

export function Room({ children, className, id = 'main', rail }: RoomProps) {
  return (
    <main className={cx('ds-room', rail !== undefined && 'ds-room--railed', className)} id={id}>
      <div className="ds-room__doc">{children}</div>
      {rail === undefined ? null : <aside className="ds-room__rail">{rail}</aside>}
    </main>
  );
}
