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
   * era and state, `/stories` by era and place, `/books` and `/law` by jurisdiction). It renders
   * AFTER the column in the document so the rail's grouping links never come before the thing
   * they group; the grid places it alongside on wide viewports and below on narrow.
   */
  readonly rail?: ReactNode;
  /**
   * Full-bleed block above the column: the record page's media masthead, the chapter's hero.
   *
   * It sits outside the measure on purpose. A masthead is the one part of these two surfaces
   * that is an image first — cropping it to a 680px text column turns the photograph into an
   * illustration beside the title rather than the thing the reader lands on.
   */
  readonly masthead?: ReactNode;
  /**
   * Full-bleed block below the column: the apparatus band — bibliography, provenance, gaps.
   *
   * Demoted here rather than deleted. Every one of these facts is load-bearing for a reader
   * checking the archive's work, and none of them is what a reader came for; in the rail they
   * turned the first screen of a record into four boxes of metadata.
   */
  readonly foot?: ReactNode;
};

export function Room({ children, className, id = 'main', rail, masthead, foot }: RoomProps) {
  return (
    <main className={cx('ds-room', className)} id={id}>
      {masthead === undefined ? null : <div className="ds-room__mast">{masthead}</div>}
      <div className={cx('ds-room__body', rail !== undefined && 'ds-room__body--railed')}>
        <div className="ds-room__doc">{children}</div>
        {rail === undefined ? null : <aside className="ds-room__rail">{rail}</aside>}
      </div>
      {foot === undefined ? null : <div className="ds-room__foot">{foot}</div>}
    </main>
  );
}
