/**
 * Surface card for editorial result and detail groupings.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';
import { headingTag, type HeadingLevel } from '../utils/heading.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type CardProps = HTMLAttributes<HTMLElement> & {
  readonly title?: string;
  readonly meta?: ReactNode;
  readonly interactive?: boolean;
  readonly as?: 'article' | 'section' | 'div';
  /** Renders the title as a heading at this level. Defaults to h3. */
  readonly headingLevel?: HeadingLevel;
  readonly children: ReactNode;
};

export function Card({
  title,
  meta,
  interactive = false,
  as: Component = 'article',
  headingLevel = 3,
  className,
  children,
  ...rest
}: CardProps) {
  const Heading = headingTag(headingLevel);

  return (
    <Component
      className={cx('ds-card', interactive && 'ds-card--interactive', className)}
      {...rest}
    >
      {title ? <Heading className="ds-card__title">{title}</Heading> : null}
      {meta ? <div className="ds-card__meta">{meta}</div> : null}
      {children}
    </Component>
  );
}
