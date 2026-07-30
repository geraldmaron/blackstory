/**
 * Teaching empty state. Names the cause, offers the fix, and gives the reader the control that
 * enacts it. Never renders a bare "no results".
 */
'use client';

import React from 'react';
import { cx } from '@repo/ui';
import { emptyStateCopy, type LensConstraints } from './empty-state';
import './empty-state.css';

void React;

export type EmptyStateProps = {
  readonly constraints: LensConstraints;
  readonly onReset?: () => void;
  readonly className?: string;
};

export function EmptyState({ constraints, onReset, className }: EmptyStateProps) {
  const copy = emptyStateCopy(constraints);

  return (
    <div className={cx('ds-empty-state', className)}>
      <p className="ds-empty-state__cause">{copy.cause}</p>
      <p className="ds-empty-state__fix">{copy.fix}</p>
      {copy.resetLabel && onReset ? (
        <button type="button" className="ds-empty-state__reset" onClick={onReset}>
          {copy.resetLabel}
        </button>
      ) : null}
    </div>
  );
}
