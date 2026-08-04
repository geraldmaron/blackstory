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
 *
 * The one exception is Library, and it is a hub rather than a destination: `/library` is where the
 * other eleven rooms are listed, generated from the same registry the palette and the footer read.
 * Without it the bar offered no route off the Atlas at all, and eleven editorial rooms sat behind a
 * keyboard shortcut a first-time reader has no reason to know about. One link to the index is not
 * the fourteen-item menu v9 removed — it is the thing that makes removing it survivable.
 *
 * Branding comes from `BRAND_ASSETS` through the shell's own wordmark classes, so the Atlas bar
 * and the site header render the same artwork with the same light/dark swap.
 */
'use client';

import React from 'react';
import Link from 'next/link';
import { BRAND_ASSETS } from '@repo/config';
import { cx, ShellWordmark } from '@repo/ui';
import { CommandBarSearch } from './CommandBarSearch';
import './command-bar.css';

void React;

export type AtlasMode = 'atlas' | 'story';

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="m10.6 10.6 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** The count is a promise the surface can keep only where it has the index loaded. */
function searchLabel(recordCount: number | undefined): string {
  return recordCount === undefined
    ? 'Search records, places, eras'
    : `Search ${recordCount.toLocaleString('en-US')} records, places, eras`;
}

export type CommandBarProps = {
  /**
   * Present only on the Atlas, where Atlas and Story are two views of one surface. Every other
   * room renders the same bar without them: a reading room has no story to switch into, and a
   * toggle that navigates instead of switching would be lying about what it does.
   */
  readonly mode?: AtlasMode;
  readonly onModeChange?: (mode: AtlasMode) => void;
  /**
   * Opens the palette, which needs a client record index only the Atlas has. Off the Atlas the
   * search slot becomes a real link to /records rather than a button that cannot do anything.
   */
  readonly onOpenPalette?: () => void;
  /** Record count for the search placeholder. Reads as a promise the surface can keep. */
  readonly recordCount?: number;
  readonly savedCount?: number;
  readonly onOpenSaved?: () => void;
  readonly onOpenShortcuts?: () => void;
  readonly onToggleTheme?: () => void;
  readonly className?: string;
};

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
      {/* The same brand component the site header and the admin shell render, so the Atlas
          cannot drift to its own artwork or its own light/dark pairing. */}
      <Link className="ds-bar__brand ds-shell-wordmark" href="/" aria-label="BlackStory · home">
        {/* Wordmark only. The `ATLAS` tag that used to sit beside it named one of the two modes
            the bar already carries as a control, so the same word appeared twice, three inches
            apart, meaning two different things. */}
        <ShellWordmark lockup={BRAND_ASSETS.lockup} symbol={BRAND_ASSETS.symbol} />
      </Link>

      {onOpenPalette ? (
        <button
          type="button"
          className="ds-bar__search"
          onClick={onOpenPalette}
          aria-label="Search records, places and actions"
        >
          <SearchGlyph />
          <span className="ds-bar__search-text">{searchLabel(recordCount)}</span>
          <kbd className="ds-kbd">⌘K</kbd>
        </button>
      ) : (
        /* Off the Atlas the slot is a live combobox against /search/api, not a link. It used to
           be an anchor to /records: identical in look and position to the Atlas's search, and
           impossible to type into, so on twelve of the thirteen rooms searching meant navigating
           somewhere else first. `<noscript>` keeps the old link for a reader without JS. */
        <>
          <CommandBarSearch placeholder={searchLabel(recordCount)} />
          <noscript>
            <Link className="ds-bar__search" href="/records" aria-label="Search the record index">
              <SearchGlyph />
              <span className="ds-bar__search-text">{searchLabel(recordCount)}</span>
            </Link>
          </noscript>
        </>
      )}

      <div className="ds-bar__tools">
        <nav className="ds-bar__modes" aria-label="Sections">
          {mode && onModeChange ? (
            <>
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
            </>
          ) : (
            /* Off the Atlas the two modes are still offered, as links rather than toggles: there is
               no surface here to switch, so each one navigates to the Atlas and arrives in the mode
               it names. Dropping Story outside the map would make it look like a feature of one
               page rather than a way into the archive.

               A fragment, not a query param: `/` normalizes its query at the edge against the
               explore allowlist, so `?mode=story` would be stripped before the page ever ran and
               the link would land on a plain Atlas. A fragment never reaches the server, so it
               cannot be stripped and cannot split the cache key either. */
            <>
              <Link className="ds-bar__mode-link ds-bar__mode-link--first" href="/">
                Atlas
              </Link>
              <Link className="ds-bar__mode-link" href="/#story">
                Story
              </Link>
            </>
          )}
          {/* An anchor, not a mode button: Atlas and Story are two views of one surface, Library
              is a different room. A real href is also what lets it be opened in a new tab and
              followed by a crawler, which a mode toggle never could. */}
          <Link className="ds-bar__mode-link" href="/library">
            Library
          </Link>
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
