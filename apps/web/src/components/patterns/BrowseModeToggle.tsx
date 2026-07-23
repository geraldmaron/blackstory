/**
 * Segmented ordered/random toggle for record browse controls. Copper signals the active
 * segment; flat matte surfaces only; 44px touch targets; theme-aware light/dark.
 */

'use client';

import React from 'react';
import type { BrowseMode } from './browse-mode';
import { browseModeLabel } from './browse-mode';

void React;

export type BrowseModeToggleProps = {
  readonly mode: BrowseMode;
  readonly onModeChange: (mode: BrowseMode) => void;
  readonly className?: string;
};

export function BrowseModeToggle({ mode, onModeChange, className }: BrowseModeToggleProps) {
  const rootClass = ['ds-browse-mode-toggle', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} role="group" aria-label="Browse mode">
      {(['ordered', 'random'] as const).map((option) => {
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            className="ds-browse-mode-toggle__option"
            aria-pressed={active}
            onClick={() => onModeChange(option)}
          >
            {browseModeLabel(option)}
          </button>
        );
      })}
    </div>
  );
}
