/**
 * A paper document: paper ground and a hard 1px edge. Square and flat (docs/ui/DESIGN.md 7.4).
 *
 * It sets `data-ground="paper"`, so every kit component inside it picks up paper-ground colors
 * (ink type, stone secondary, copper text) in both themes without a variant prop.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type SheetProps = HTMLAttributes<HTMLElement> & {
  readonly as?: 'article' | 'section' | 'div' | 'aside' | 'main';
  readonly children: ReactNode;
};

export function Sheet({ as: Component = 'div', className, children, ...rest }: SheetProps) {
  return (
    <Component className={cx('ds-sheet', className)} data-ground="paper" {...rest}>
      {children}
    </Component>
  );
}
