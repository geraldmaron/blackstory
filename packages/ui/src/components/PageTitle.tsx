/**
 * The display-scale page title (Schibsted at the display weight, 56-120px, tight leading). It may run two
 * lines and bleed toward the edge. One per page; `PageHeader display` renders the same style.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type PageTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  readonly as?: 'h1' | 'h2';
  readonly children: ReactNode;
};

export function PageTitle({ as: Component = 'h1', className, children, ...rest }: PageTitleProps) {
  return (
    <Component className={cx('ds-page-title', className)} {...rest}>
      {children}
    </Component>
  );
}
