/**
 * Reusable record carousel toolbar: prev/next, optional dot rail, ordered/random toggle,
 * and position counter. Parents own index state and navigation side effects.
 */

'use client';

import React, { type KeyboardEvent } from 'react';
import { BrowseModeToggle } from './BrowseModeToggle';
import type { BrowseMode } from './browse-mode';
import { formatBrowsePosition } from './browse-mode';

void React;

export type RecordBrowseControlsProps = {
  readonly total: number;
  readonly index: number;
  readonly mode: BrowseMode;
  readonly onModeChange: (mode: BrowseMode) => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onGoTo?: (index: number) => void;
  readonly itemIds?: readonly string[];
  readonly ariaLabel?: string;
  readonly className?: string;
};

export function RecordBrowseControls({
  total,
  index,
  mode,
  onModeChange,
  onPrevious,
  onNext,
  onGoTo,
  itemIds,
  ariaLabel = 'Browse records',
  className,
}: RecordBrowseControlsProps) {
  const safeIndex = total > 0 ? index % total : 0;
  const rootClass = ['ds-record-browse', className].filter(Boolean).join(' ');
  const showDots = Boolean(onGoTo && itemIds && itemIds.length > 0 && itemIds.length <= 12);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onPrevious();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNext();
    }
  }

  return (
    <div
      className={rootClass}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel controls"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <div className="ds-record-browse__nav">
        <button
          type="button"
          className="ds-record-browse__arrow"
          aria-label={mode === 'random' ? 'Previous random record' : 'Previous record'}
          onClick={onPrevious}
          disabled={total <= 1}
        >
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M9 3 L5 7 L9 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="ds-record-browse__arrow"
          aria-label={mode === 'random' ? 'Next random record' : 'Next record in list'}
          onClick={onNext}
          disabled={total <= 1}
        >
          <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M5 3 L9 7 L5 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {showDots && itemIds ? (
        <ul className="ds-record-browse__dots" aria-label="Record position">
          {itemIds.map((id, dotIndex) => (
            <li key={id}>
              <button
                type="button"
                className="ds-record-browse__dot"
                aria-label={`Record ${dotIndex + 1}`}
                aria-current={dotIndex === safeIndex ? 'true' : undefined}
                onClick={() => onGoTo?.(dotIndex)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <BrowseModeToggle mode={mode} onModeChange={onModeChange} />

      <span className="ds-record-browse__position" aria-live="polite">
        {formatBrowsePosition(safeIndex, total, mode)}
      </span>
    </div>
  );
}
