/** Prose at the reading measure, with hairline rules between its sections. */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';

void React;

export type ProseProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function Prose({ children, className }: ProseProps) {
  return <div className={cx('ds-doc-prose', className)}>{children}</div>;
}
