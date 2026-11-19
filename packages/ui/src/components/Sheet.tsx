/**
 * A paper document on the archive table: paper ground, a hard 1px edge, radius 14 (none on a
 * phone, where it runs full-bleed) and the three page bands along one edge.
 *
 * It sets `data-ground="paper"`, so every kit component inside it picks up paper-ground colors
 * (ink type, stone secondary, copper text) in both themes without a variant prop.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type SheetProps = HTMLAttributes<HTMLElement> & {
  readonly as?: 'article' | 'section' | 'div' | 'aside' | 'main';
  /** Which edge carries the page bands: the start edge by default, the end edge for a column
   *  that sits at the left of a map (its inner edge), or none. */
  readonly bands?: 'start' | 'end' | 'none';
  readonly children: ReactNode;
};

export function Sheet({
  as: Component = 'div',
  bands = 'start',
  className,
  children,
  ...rest
}: SheetProps) {
  return (
    <Component
      className={cx('ds-sheet', bands !== 'start' && `ds-sheet--bands-${bands}`, className)}
      data-ground="paper"
      {...rest}
    >
      {children}
    </Component>
  );
}
