
/**
 * Empty-state panel for zero-result and unset collection screens.
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// `React` is otherwise unused under this package's own automatic JSX runtime, but keeping it
// imported makes this file safe to cross-transpile from a consumer whose own tsconfig uses a
// classic JSX transform (see Notice.tsx's identical note).
void React;

export type EmptyStateProps = {
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cx('bb-empty', className)} role="status">
      <h2 className="bb-empty__title">{title}</h2>
      <div className="bb-empty__body">{children}</div>
      {action}
    </div>
  );
}
