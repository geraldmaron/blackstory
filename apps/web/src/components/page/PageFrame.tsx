/**
 * PageFrame: the page frame every Reading, Record and Utility surface renders inside.
 *
 * Every page sits on one of the three shared containers from `@repo/ui` (read 680, record 964,
 * wide 1152; `.ds-wrap`). A page picks one with `width` and never sets a measure of its own:
 * per-route widths are how three surface classes ended up drawn at a dozen different widths.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

export type PageWidth = 'read' | 'record' | 'wide';

export type PageFrameProps = {
  readonly children: ReactNode;
  readonly className?: string;
  /** Overrides the `<main>` element id. Skip-link target; defaults to the shell's `main`. */
  readonly id?: string;
  /**
   * The container. Trust and utility pages read at `read`, record pages at `record`, indexes,
   * charts and catalogs at `wide`. The default is `record` because the memorial wall (protected,
   * see docs/ui/PROTECTED-EXPERIENCES.md) renders a bare `<PageFrame>`.
   */
  readonly width?: PageWidth;
  /**
   * Optional right rail. It renders AFTER the column in the document so the rail's links never
   * come before the thing they group; the grid places it alongside on wide viewports and below
   * on narrow.
   */
  readonly rail?: ReactNode;
  /** Full-bleed block above the column: the record page's media masthead, the chapter's hero. */
  readonly masthead?: ReactNode;
  /** Full-bleed block below the column: the apparatus band (bibliography, provenance, gaps). */
  readonly foot?: ReactNode;
};

export function PageFrame({
  children,
  className,
  id = 'main',
  width = 'record',
  rail,
  masthead,
  foot,
}: PageFrameProps) {
  return (
    <main className={cx('ds-doc', className)} id={id}>
      {masthead === undefined ? null : <div className="ds-doc__mast">{masthead}</div>}
      <div
        className={cx(
          'ds-doc__body',
          'ds-wrap',
          width !== 'wide' && `ds-wrap--${width}`,
          rail !== undefined && 'ds-doc__body--railed',
        )}
      >
        <div className="ds-doc__column">{children}</div>
        {rail === undefined ? null : <aside className="ds-doc__rail">{rail}</aside>}
      </div>
      {foot === undefined ? null : <div className="ds-doc__foot">{foot}</div>}
    </main>
  );
}
