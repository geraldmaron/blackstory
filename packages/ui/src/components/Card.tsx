/**
 * Surface card for editorial result and detail groupings.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type CardProps = HTMLAttributes<HTMLElement> & {
  readonly title?: string;
  readonly meta?: ReactNode;
  readonly interactive?: boolean;
  readonly as?: 'article' | 'section' | 'div';
  readonly children: ReactNode;
};

export function Card({
  title,
  meta,
  interactive = false,
  as: Component = 'article',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cx('bb-card', interactive && 'bb-card--interactive', className)}
      {...rest}
    >
      {title ? <h3 className="bb-card__title">{title}</h3> : null}
      {meta ? <div className="bb-card__meta">{meta}</div> : null}
      {children}
    </Component>
  );
}
