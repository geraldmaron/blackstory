/**
 * The header, on every route: lockup, the four tabs as plain text links, the one search, the
 * theme control.
 *
 * From 48rem up it is a flush 52px ink bar fixed to the top, its content aligned to the wide
 * container. The search rests as a compact "Search" control at the right and opens in place to the
 * full field on focus, `/` or Cmd-K (command-bar.css). Below 48rem it is an in-flow 48px bar with
 * the lockup, a search button and the theme control; the search button opens the same combobox full screen, and the tabs move to the bottom
 * tab bar (`PhoneTabBar`). There is one search field in the DOM at every width, so there is never
 * a second box to type into.
 *
 * Home is the lockup, not a tab. Map, Records, Stories and More come from `shell-tabs.ts`, which
 * the phone tab bar reads too.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { surfaceClassFor } from '../../lib/nav/surface-classes';
import { BRAND_ASSETS } from '@repo/config';
import { cx, ShellWordmark, Tabs, toggleDocumentTheme, type TabItem } from '@repo/ui';
import { BAR_SEARCH_INPUT_ID, CommandBarSearch } from './CommandBarSearch';
import { PhoneTabBar } from './PhoneTabBar';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { SHELL_TABS, currentTabFor } from './shell-tabs';
import './command-bar.css';

/** Tab label with its destination glyph beside the word, matching the phone tab bar. */
function tabLabel(tab: (typeof SHELL_TABS)[number]) {
  return (
    <span className="ds-destination-label">
      <DestinationIcon id={tab.icon} />
      {tab.label}
    </span>
  );
}

void React;

export type AtlasMode = 'atlas' | 'story';

export type CommandBarProps = {
  /** The active query on routes that carry `?q`, so the field shows what was searched. */
  readonly query?: string | undefined;
  /**
   * Accepted from the Atlas caller (`AtlasExperience`), which is not mounted on any public route.
   * The header search is the only search; the palette stays the ⌘K layer.
   */
  readonly mode?: AtlasMode;
  readonly onModeChange?: (mode: AtlasMode) => void;
  readonly onOpenPalette?: () => void;
  readonly recordCount?: number;
  readonly savedCount?: number;
  readonly onOpenSaved?: () => void;
  readonly onOpenShortcuts?: () => void;
  /** Defaults to the document theme switch. */
  readonly onToggleTheme?: () => void;
  readonly className?: string;
};

function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ThemeGlyphs() {
  return (
    <>
      {/* Both render; CSS shows the one for the theme on <html> (components.css), so first paint
          matches the head bootstrap. Moon = switch to dark, sun = switch to light. */}
      <svg
        className="ds-theme-toggle__icon ds-theme-toggle__icon--to-dark"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        className="ds-theme-toggle__icon ds-theme-toggle__icon--to-light"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 1.5v2.2M10 16.3v2.2M18.5 10h-2.2M3.7 10H1.5M16 4l-1.6 1.6M5.6 14.4 4 16M16 16l-1.6-1.6M5.6 5.6 4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </>
  );
}

export function CommandBar({
  query,
  savedCount = 0,
  onOpenSaved,
  onOpenShortcuts,
  onToggleTheme,
  className,
}: CommandBarProps) {
  const pathname = usePathname() || '/';
  const [searchOpen, setSearchOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  // A route change (a picked suggestion, a submitted search) ends the phone search sheet.
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  // The phone sheet is modal: the page behind it goes inert and stops scrolling, Escape closes it.
  useEffect(() => {
    if (!searchOpen) return;
    // The header's own brand link, tabs and tools sit behind the sheet too; leaving them focusable
    // let Tab walk out of a dialog that declares aria-modal.
    const behind = document.querySelectorAll(
      '.ds-shell-body, .ds-shell-footer, .ds-tabbar, .ds-bar__brand, .ds-bar__tabs, .ds-bar__tools',
    );
    behind.forEach((element) => element.setAttribute('inert', ''));
    document.documentElement.dataset.searchSheet = 'open';
    document.getElementById(BAR_SEARCH_INPUT_ID)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearch();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      behind.forEach((element) => element.removeAttribute('inert'));
      delete document.documentElement.dataset.searchSheet;
      // Focus goes back to the opener only now: it sits in the tools group, which was inert.
      openerRef.current?.focus();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [searchOpen, closeSearch]);

  const current = currentTabFor(pathname);
  const tabs: TabItem[] = SHELL_TABS.map((tab) => ({
    label: tabLabel(tab),
    href: tab.href,
    current: current === tab.id,
  }));

  return (
    <>
      <header
        className={cx('ds-bar', className)}
        data-ground="ink"
        // On the front page the bar stands on the map's ink ground in either theme.
        {...(surfaceClassFor(pathname) === 'door' ? { 'data-ground-fixed': '' } : {})}
        data-browse-chrome="true"
        data-search-open={searchOpen ? 'true' : undefined}
      >
        <div className="ds-bar__inner">
          <Link className="ds-bar__brand ds-shell-wordmark" href="/" aria-label="BlackStory, home">
            <ShellWordmark lockup={BRAND_ASSETS.lockup} />
          </Link>

          <Tabs className="ds-bar__tabs" label="Main" items={tabs} linkAs={Link} />

          <div
            className="ds-bar__search-region"
            role={searchOpen ? 'dialog' : undefined}
            aria-modal={searchOpen ? 'true' : undefined}
            aria-label={searchOpen ? 'Search' : undefined}
          >
            <CommandBarSearch placeholder="Search" query={query} />
            <button type="button" className="ds-bar__search-cancel" onClick={closeSearch}>
              Cancel
            </button>
          </div>

          <div className="ds-bar__tools">
            {onOpenSaved ? (
              <button
                type="button"
                className="ds-bar__tool"
                onClick={onOpenSaved}
                aria-label={
                  savedCount === 0 ? 'Saved records' : `Saved records, ${savedCount} saved`
                }
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 2.6h8a.6.6 0 0 1 .6.6v10.2L8 10.6l-4.6 2.8V3.2a.6.6 0 0 1 .6-.6Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
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
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect
                    x="1.4"
                    y="3.6"
                    width="13.2"
                    height="8.8"
                    rx="1.6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M4 6.4h.01M6.3 6.4h.01M8.6 6.4h.01M10.9 6.4h.01M4.6 9.4h6.8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}

            <button
              ref={openerRef}
              type="button"
              className="ds-bar__tool ds-bar__search-open"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
            >
              <SearchGlyph />
            </button>

            <button
              type="button"
              className="ds-bar__tool"
              onClick={onToggleTheme ?? toggleDocumentTheme}
              aria-label="Switch between light and dark"
            >
              <ThemeGlyphs />
            </button>
          </div>
        </div>
      </header>
      {/* A sibling of the header, not a child, so the header's own stacking never traps it. */}
      <PhoneTabBar pathname={pathname} />
    </>
  );
}
