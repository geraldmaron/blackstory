/**
 * The one panel recipe: raised fill, 1px rule border, radius 14, no shadow. A surface holds at
 * most one bordered level; anything inside it is separated by rules, never by another box.
 *
 * `floating` is for layers over the map, which get the single soft contact shadow.
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';
import { headingTag, type HeadingLevel } from '../utils/heading.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  readonly title?: string;
  readonly meta?: ReactNode;
  readonly floating?: boolean;
  readonly as?: 'article' | 'section' | 'div';
  /** Renders the title as a heading at this level. Defaults to h3. */
  readonly headingLevel?: HeadingLevel;
  readonly children: ReactNode;
};

export function Surface({
  title,
  meta,
  floating = false,
  as: Component = 'article',
  headingLevel = 3,
  className,
  children,
  ...rest
}: SurfaceProps) {
  const Heading = headingTag(headingLevel);

  return (
    <Component
      className={cx('ds-surface', floating && 'ds-surface--floating', className)}
      {...rest}
    >
      {title ? <Heading className="ds-surface__title">{title}</Heading> : null}
      {meta ? <div className="ds-surface__meta">{meta}</div> : null}
      {children}
    </Component>
  );
}
