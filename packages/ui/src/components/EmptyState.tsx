/**
 * Empty-state panel for zero-result and unset collection screens.
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';
import { headingTag, type HeadingLevel } from '../utils/heading.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type EmptyStateProps = {
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
  /** Renders the title as a heading at this level. Defaults to h2. */
  readonly headingLevel?: HeadingLevel;
  readonly className?: string;
};

export function EmptyState({
  title,
  children,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingTag(headingLevel);

  return (
    <div className={cx('ds-empty', className)} role="status">
      <Heading className="ds-empty__title">{title}</Heading>
      <div className="ds-empty__body">{children}</div>
      {action}
    </div>
  );
}
