/**
 * Sticky bulk-action bar for selection-driven operator surfaces.
 *
 * The distinction this component exists to make visible is page-selection versus
 * match-selection. Selecting the header checkbox selects the 50 rows you can see; operators
 * working a 3,195-row filter almost always mean all 3,195. Offering that as an explicit second
 * step — with the real number spelled out — is what keeps a bulk action from being either
 * uselessly small or terrifyingly large by accident.
 */

'use client';

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type SelectionBarProps = {
  readonly selectedCount: number;
  /** Total rows matching the current filter, across every page. */
  readonly matchCount: number;
  /** True once the selection has been escalated from this page to the whole match set. */
  readonly allMatchesSelected?: boolean;
  readonly onSelectAllMatches?: () => void;
  readonly onClear: () => void;
  readonly children?: ReactNode;
  readonly className?: string;
};

export function SelectionBar({
  selectedCount,
  matchCount,
  allMatchesSelected = false,
  onSelectAllMatches,
  onClear,
  children,
  className,
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  const canEscalate =
    Boolean(onSelectAllMatches) && !allMatchesSelected && matchCount > selectedCount;

  return (
    <div
      className={cx('ds-selection-bar', className)}
      role="region"
      aria-label="Bulk actions"
      // Announce selection size changes without stealing focus from the table.
      aria-live="polite"
    >
      <p className="ds-selection-bar__count">
        <strong>{selectedCount.toLocaleString()}</strong>{' '}
        {selectedCount === 1 ? 'entity' : 'entities'} selected
        {allMatchesSelected ? ' — every match in this filter' : ''}
      </p>

      {canEscalate ? (
        <button type="button" className="ds-selection-bar__escalate" onClick={onSelectAllMatches}>
          Select all {matchCount.toLocaleString()} matching this filter
        </button>
      ) : null}

      <div className="ds-selection-bar__actions">{children}</div>

      <button type="button" className="ds-selection-bar__clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
