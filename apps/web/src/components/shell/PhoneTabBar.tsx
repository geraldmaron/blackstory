/**
 * The phone's primary navigation: a tab bar along the bottom edge, the same four destinations on
 * every page — Map, Stories, Records, Rooms.
 *
 * This is the platform convention for top-level destinations on a compact screen (Apple's tab
 * bars, Material's navigation bar; Google Maps, Apple Maps and Airbnb on the web): fixed at the
 * bottom where a thumb rests, always the same set in the same order, the current one marked.
 * It replaces a Map/Stories/Records/Rooms pill crowded into the top-right of a two-row header
 * card, which also changed its own contents per page (Map + Rooms on map pages, four on others).
 *
 * Rooms opens the room list in a native `<dialog>` sheet: focus moves in, the page behind goes
 * inert, Escape and the backdrop close it — the platform's modal, not a hand-built one. It moves
 * like a platform sheet too: it slides up, it slides back down when closed (by any route: the
 * close button, Escape, the backdrop, a room link), and its header drags down to dismiss it.
 *
 * Shown below 820px only (tab-bar.css). Desktop keeps the command bar's own links.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  primaryNavDestinations,
  destinationsInGroup,
  ROOMS_CARD_GROUPS,
} from '../../lib/nav/destination-registry';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { exitMapBrowse } from '../../lib/nav/map-browse';
import { RoomsList } from './RoomsList';
import './tab-bar.css';
import './rooms-menu.css';

void React;

const AXES = primaryNavDestinations();
const ROOM_PATHS = ROOMS_CARD_GROUPS.flatMap((group) =>
  destinationsInGroup(group).map((destination) => destination.path),
);

/** Past this, a downward drag on the header dismisses the sheet — the Explore sheets' threshold
 * (`use-compact-sheet-drag.ts`), so every sheet on a phone answers a drag the same way. */
const SHEET_DISMISS_PX = 80;
/** A flick dismisses however short it was (px per ms), as on the Explore sheets. */
const SHEET_FLICK_SPEED = 0.6;
/** If `transitionend` never arrives (reduced motion toggled mid-close, a hidden tab), close anyway. */
const SHEET_CLOSE_FALLBACK_MS = 450;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function pathIsMapSurface(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/explore');
}

function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Which tab is current. A record or place page belongs to Records, the catalog that lists it. */
export function currentTabFor(
  pathname: string,
): '/explore' | '/stories' | '/records' | '/rooms' | null {
  if (pathIsMapSurface(pathname)) return '/explore';
  if (under(pathname, '/stories')) return '/stories';
  if (under(pathname, '/records') || under(pathname, '/entity') || under(pathname, '/place')) {
    return '/records';
  }
  if (under(pathname, '/rooms') || ROOM_PATHS.some((path) => under(pathname, path)))
    return '/rooms';
  return null;
}

export type PhoneTabBarProps = {
  readonly pathname: string;
  /** The Door's full-screen "Browse the map" posture is on. */
  readonly browsing: boolean;
};

export function PhoneTabBar({ pathname, browsing }: PhoneTabBarProps) {
  const current = currentTabFor(pathname);
  const sheetRef = useRef<HTMLDialogElement | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    speed: number;
  } | null>(null);

  // Close the sheet whenever the route changes underneath it. The page is already changing, so
  // this one is immediate.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet?.open) return;
    delete sheet.dataset.closing;
    sheet.style.transform = '';
    sheet.style.transition = '';
    sheet.close();
  }, [pathname]);

  /**
   * Slide the sheet away, then close the dialog. Every way of closing goes through here so the
   * sheet never vanishes in one frame. The slide starts from wherever the sheet is — the header
   * drag leaves it part-way down, and the transition carries on from there.
   */
  const dismiss = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet?.open || sheet.dataset.closing) return;
    if (prefersReducedMotion()) {
      sheet.close();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallback);
      sheet.removeEventListener('transitionend', onEnd);
      if (sheet.open) sheet.close();
      delete sheet.dataset.closing;
      sheet.style.transform = '';
      sheet.style.transition = '';
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === sheet && event.propertyName === 'transform') finish();
    };
    sheet.addEventListener('transitionend', onEnd);
    const fallback = window.setTimeout(finish, SHEET_CLOSE_FALLBACK_MS);
    // Hand `transform` back to the stylesheet and flag the close in the same frame: the
    // transition runs from the current (possibly dragged) offset to off-screen.
    sheet.style.transition = '';
    sheet.style.transform = '';
    sheet.dataset.closing = 'true';
  }, []);

  const onHeadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const sheet = sheetRef.current;
    if (!sheet || sheet.dataset.closing) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      speed: 0,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    sheet.style.transition = 'none';
  };

  const onHeadPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || event.pointerId !== drag.pointerId) return;
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    drag.speed = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    // Free downward; upward is held at the top (the sheet is already as tall as it gets).
    sheet.style.transform = `translateY(${Math.max(0, event.clientY - drag.startY)}px)`;
  };

  const onHeadPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (!drag || !sheet || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    // The last tracked move, not the release coordinates (some platforms report (0, 0) there).
    const dy = drag.lastY - drag.startY;
    const flick = dy > 12 && drag.speed > SHEET_FLICK_SPEED;
    if (event.type !== 'pointercancel' && (dy > SHEET_DISMISS_PX || flick)) {
      dismiss();
      return;
    }
    sheet.style.transition = '';
    sheet.style.transform = '';
  };

  const openRooms = () => {
    const sheet = sheetRef.current;
    if (!sheet || sheet.open) return;
    sheet.showModal();
    setRoomsOpen(true);
  };

  return (
    <>
      <nav className="ds-tabbar" aria-label="Main">
        {AXES.map((axis) => {
          const isCurrent = current === axis.path;
          const mark = (
            <>
              <DestinationIcon id={axis.icon} />
              <span className="ds-tabbar__label">{axis.label}</span>
            </>
          );
          if (axis.path === '/rooms') {
            return (
              <button
                key={axis.path}
                type="button"
                className="ds-tabbar__tab"
                aria-haspopup="dialog"
                aria-expanded={roomsOpen}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={openRooms}
              >
                {mark}
              </button>
            );
          }
          if (axis.path === '/explore') {
            // The map's home is the Door. Pressing the current tab returns to its start (the
            // platform convention): while browsing the map full screen, that is the journey.
            if (pathIsMapSurface(pathname)) {
              return browsing ? (
                <button
                  key={axis.path}
                  type="button"
                  className="ds-tabbar__tab"
                  aria-current="page"
                  // The visible name stays "Map" (the name starts with it, WCAG 2.5.3); the
                  // accessible name says what pressing it does, since the phone has no
                  // separate "Back to journey" pill.
                  aria-label={`${axis.label}, back to the journey`}
                  title="Back to the journey"
                  onClick={() => exitMapBrowse()}
                >
                  {mark}
                </button>
              ) : (
                <span key={axis.path} className="ds-tabbar__tab" aria-current="page">
                  {mark}
                </span>
              );
            }
            return (
              <Link key={axis.path} className="ds-tabbar__tab" href="/" prefetch={false}>
                {mark}
              </Link>
            );
          }
          return (
            <Link
              key={axis.path}
              className="ds-tabbar__tab"
              href={axis.path}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {mark}
            </Link>
          );
        })}
      </nav>

      <dialog
        ref={sheetRef}
        className="ds-tabbar-sheet"
        aria-label="Rooms"
        onClose={() => setRoomsOpen(false)}
        onCancel={(event) => {
          // Escape: slide away rather than vanish.
          event.preventDefault();
          dismiss();
        }}
        onClick={(event) => {
          // A click on the backdrop (the dialog element itself, outside its content) closes it.
          if (event.target === event.currentTarget) dismiss();
        }}
      >
        <div
          className="ds-tabbar-sheet__head"
          onPointerDown={onHeadPointerDown}
          onPointerMove={onHeadPointerMove}
          onPointerUp={onHeadPointerEnd}
          onPointerCancel={onHeadPointerEnd}
        >
          <span className="ds-tabbar-sheet__grab" aria-hidden="true" />
          <h2 className="ds-tabbar-sheet__title">Rooms</h2>
          <button
            type="button"
            className="ds-tabbar-sheet__close"
            aria-label="Close"
            onClick={dismiss}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 3.5l9 9m0-9-9 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="ds-tabbar-sheet__body">
          <RoomsList onNavigate={dismiss} />
        </div>
      </dialog>
    </>
  );
}
