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
 * inert, Escape and the backdrop close it — the platform's modal, not a hand-built one.
 *
 * Shown below 820px only (tab-bar.css). Desktop keeps the command bar's own links.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
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

  // Close the sheet whenever the route changes underneath it.
  useEffect(() => {
    sheetRef.current?.close();
  }, [pathname]);

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
        onClick={(event) => {
          // A click on the backdrop (the dialog element itself, outside its content) closes it.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="ds-tabbar-sheet__body">
          <div className="ds-tabbar-sheet__head">
            <h2 className="ds-tabbar-sheet__title">Rooms</h2>
            <button
              type="button"
              className="ds-tabbar-sheet__close"
              aria-label="Close"
              onClick={() => sheetRef.current?.close()}
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
          <RoomsList onNavigate={() => sheetRef.current?.close()} />
        </div>
      </dialog>
    </>
  );
}
