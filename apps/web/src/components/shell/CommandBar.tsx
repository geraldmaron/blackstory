/**
 * Command bar — fixed top, z 50. Brand, search, the four product axes, Rooms, tools.
 *
 * The axes are derived from the destination registry rather than written out here. This bar was
 * the last hand-kept nav list on the site: it named Door, Explore and Records, which meant
 * Stories — one of the four ways into the product — was reachable only through the Rooms menu,
 * and the bar could not notice when a route it named stopped existing.
 *
 * Home is the brand lockup on the left, on every surface. It is not a nav item: a "Door" link
 * beside Explore read as a fifth destination competing with the archive.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND_ASSETS } from '@repo/config';
import { cx, ShellWordmark } from '@repo/ui';
import { CommandBarSearch } from './CommandBarSearch';
import { RoomsMenu } from './RoomsMenu';
import { primaryNavDestinations } from '../../lib/nav/destination-registry';
import './command-bar.css';

void React;

/**
 * Explore, Stories, Records — the three axes the bar renders as plain links. Rooms is the fourth
 * and renders as {@link RoomsMenu}, a disclosure whose panel lists the rooms and links the hub;
 * a separate `Rooms` link beside it would be the same destination twice.
 *
 * Computed once at module scope: the registry is static data and this bar mounts on every route.
 */
const AXES = primaryNavDestinations().filter((axis) => axis.path !== '/rooms');

/** Writes measured command-bar clearance to the document root for Door/room layout tokens. */
export function syncCommandBarClearance(bar: HTMLElement): void {
  const bottomPx = bar.getBoundingClientRect().bottom;
  if (!Number.isFinite(bottomPx) || bottomPx <= 0) {
    return;
  }
  document.documentElement.style.setProperty(
    '--ds-island-clearance',
    `calc(${bottomPx}px + var(--ds-island-gap))`,
  );
}

export type AtlasMode = 'atlas' | 'story';

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="m10.6 10.6 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Search greets the reader. The catalog count is not that greeting. */
function searchLabel(): string {
  return 'Search records, places, eras';
}

function pathIsCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type CommandBarProps = {
  /**
   * Present when the Explore instrument mounts this bar (palette / saved / shortcuts). Off
   * Explore the bar shows Find links instead.
   */
  readonly mode?: AtlasMode;
  readonly onModeChange?: (mode: AtlasMode) => void;
  /**
   * Opens the palette, which needs a client record index only Explore has. Off Explore the
   * search slot becomes a real combobox against /search/api.
   */
  readonly onOpenPalette?: () => void;
  /** Kept so existing Explore callers compile. Search no longer greets with this count. */
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
  savedCount = 0,
  onOpenSaved,
  onOpenShortcuts,
  onToggleTheme,
  className,
}: CommandBarProps) {
  const pathname = usePathname() || '/';
  const onAtlas = Boolean(mode && onModeChange);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }
    syncCommandBarClearance(bar);
    const observer = new ResizeObserver(() => {
      syncCommandBarClearance(bar);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
    };
  }, [onAtlas, onOpenPalette]);

  return (
    <header ref={barRef} className={cx('ds-bar', className)}>
      <Link className="ds-bar__brand ds-shell-wordmark" href="/" aria-label="BlackStory · home">
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
          <span className="ds-bar__search-text">{searchLabel()}</span>
          <kbd className="ds-kbd">⌘K</kbd>
        </button>
      ) : (
        <>
          <CommandBarSearch placeholder={searchLabel()} />
          <noscript>
            <Link className="ds-bar__search" href="/records" aria-label="Search the record index">
              <SearchGlyph />
              <span className="ds-bar__search-text">{searchLabel()}</span>
            </Link>
          </noscript>
        </>
      )}

      <div className="ds-bar__tools">
        <nav className="ds-bar__modes" aria-label="Find">
          {AXES.map((axis) => {
            const current = pathIsCurrent(pathname, axis.path);
            // On the Explore instrument the bar names the surface the reader is standing on
            // rather than offering it as a link back to itself.
            return current && axis.path === '/explore' ? (
              <span key={axis.path} className="ds-bar__mode-link" aria-current="page">
                {axis.label}
              </span>
            ) : (
              <Link
                key={axis.path}
                className="ds-bar__mode-link"
                href={axis.path}
                {...(axis.path === '/explore' ? { prefetch: false } : {})}
                aria-current={current ? 'page' : undefined}
              >
                {axis.label}
              </Link>
            );
          })}
          <RoomsMenu />
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
