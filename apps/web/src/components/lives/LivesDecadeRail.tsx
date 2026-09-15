import React, { useEffect, useRef, type KeyboardEvent } from 'react';
import type { LivesDecadeBundle } from '@repo/domain/statistics/lives';

void React;

export type LivesDecadeRailProps = {
  readonly decades: readonly LivesDecadeBundle[];
  readonly selected: number;
  readonly onSelect: (decade: number) => void;
  /** id of the panel the tabs control. */
  readonly panelId: string;
};

const BOUNDARY_LABEL = {
  none: null,
  method_note: 'Income measure adjusted',
  different_measure: 'Class measured differently',
  gap: 'No census records',
} as const;

/**
 * Keyboard tablist of decades. Arrow keys, Home and End move between decades; only the selected
 * decade is in the tab order. A boundary tick marks where the class measure changes so a reader
 * sees the break before comparing across it.
 */
export function LivesDecadeRail({ decades, selected, onSelect, panelId }: LivesDecadeRailProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    decades.findIndex((decade) => decade.decade === selected),
  );

  // Keep the selected decade visible on a narrow rail. `block: 'nearest'` scrolls the row only,
  // never the page, and reduced-motion readers get an instant jump.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    refs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [selectedIndex]);

  function moveTo(index: number) {
    const clamped = Math.min(decades.length - 1, Math.max(0, index));
    const target = decades[clamped];
    if (!target) return;
    onSelect(target.decade);
    refs.current[clamped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo(selectedIndex + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(selectedIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(decades.length - 1);
    }
  }

  return (
    <div className="lives-rail" role="tablist" aria-label="Decade">
      {decades.map((decade, index) => {
        const isSelected = index === selectedIndex;
        const boundary = BOUNDARY_LABEL[decade.boundaryFromPrevious];
        return (
          <button
            key={decade.decade}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`lives-decade-${decade.decade}`}
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={isSelected ? 0 : -1}
            className="lives-rail__tab"
            data-regime={decade.regime}
            data-boundary={decade.boundaryFromPrevious}
            onClick={() => onSelect(decade.decade)}
            onKeyDown={onKeyDown}
          >
            <span className="lives-rail__label">{decade.label}</span>
            {boundary ? <span className="lives-sr-only">, {boundary}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
