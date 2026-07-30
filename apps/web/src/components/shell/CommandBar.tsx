/**
 * Command bar — fixed top, z 50. Brand, the search trigger, two modes, tools.
 *
 * The centre slot is the single biggest change in v9. v6's shell carried fourteen destinations,
 * six of them top-level and one of them a `MORE` menu hiding nine more. Navigation moves into the
 * palette; the bar carries two modes (design-direction-v9-atlas.md §5.1).
 *
 * Destinations that leave the bar do not leave the site. They stay reachable from the palette and
 * from the site footer, and `CommandBar` deliberately does not render a nav menu of its own so
 * there is no third place for that list to drift.
 */
'use client';

import React from 'react';
import { cx } from '@repo/ui';
import './command-bar.css';

void React;

export type AtlasMode = 'atlas' | 'story';

export type CommandBarProps = {
  readonly mode: AtlasMode;
  readonly onModeChange: (mode: AtlasMode) => void;
  readonly onOpenPalette: () => void;
  /** Record count for the search placeholder. Reads as a promise the surface can keep. */
  readonly recordCount: number;
  readonly savedCount?: number;
  readonly onOpenSaved?: () => void;
  readonly onOpenShortcuts?: () => void;
  readonly onToggleTheme?: () => void;
  readonly className?: string;
};

function BrandMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="2.5"
        width="15"
        height="19"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 7h7M7 10.5h7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".55"
      />
      <path
        d="M16.5 12.2c0 2.6-3 5.6-3 5.6s-3-3-3-5.6a3 3 0 1 1 6 0Z"
        fill="var(--ds-accent-graphic)"
      />
      <circle cx="13.5" cy="12.1" r="1.05" fill="var(--ds-surface)" />
    </svg>
  );
}

export function CommandBar({
  mode,
  onModeChange,
  onOpenPalette,
  recordCount,
  savedCount = 0,
  onOpenSaved,
  onOpenShortcuts,
  onToggleTheme,
  className,
}: CommandBarProps) {
  return (
    <header className={cx('ds-bar', className)}>
      <a className="ds-bar__brand" href="/">
        <BrandMark />
        <b className="ds-bar__wordmark">BlackStory</b>
        <span className="ds-bar__tag">Atlas</span>
      </a>

      <button
        type="button"
        className="ds-bar__search"
        onClick={onOpenPalette}
        aria-label="Search records, places and actions"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="m10.6 10.6 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="ds-bar__search-text">
          Search {recordCount.toLocaleString('en-US')} records, places, eras
        </span>
        <kbd className="ds-kbd">⌘K</kbd>
      </button>

      <div className="ds-bar__tools">
        <nav className="ds-bar__modes" aria-label="Mode">
          <button
            type="button"
            onClick={() => onModeChange('atlas')}
            aria-current={mode === 'atlas' ? 'true' : undefined}
          >
            Atlas
          </button>
          <button
            type="button"
            onClick={() => onModeChange('story')}
            aria-current={mode === 'story' ? 'true' : undefined}
          >
            Story
          </button>
        </nav>

        {onOpenSaved ? (
          <button
            type="button"
            className="ds-bar__tool"
            onClick={onOpenSaved}
            aria-label={savedCount === 0 ? 'Saved records' : `Saved records, ${savedCount} saved`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 2.6h8a.6.6 0 0 1 .6.6v10.2L8 10.6l-4.6 2.8V3.2a.6.6 0 0 1 .6-.6Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            {savedCount > 0 ? (
              <span className="ds-bar__badge" aria-hidden="true">
                {savedCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {onOpenShortcuts ? (
          <button
            type="button"
            className="ds-bar__tool"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect
                x="1.4"
                y="3.6"
                width="13.2"
                height="8.8"
                rx="1.6"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M4 6.4h.01M6.3 6.4h.01M8.6 6.4h.01M10.9 6.4h.01M4.6 9.4h6.8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}

        {onToggleTheme ? (
          <button
            type="button"
            className="ds-bar__tool"
            onClick={onToggleTheme}
            aria-label="Switch between light and dark"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 1.3v1.5M8 13.2v1.5M1.3 8h1.5M13.2 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  );
}
