/**
 * Surface card for editorial result and detail groupings.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils/cx.js';

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
