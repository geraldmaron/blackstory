/**
 * The Rooms axis in the desktop command bar: a disclosure listing the supporting rooms, plus a
 * link to the hub itself. The other axes (Map, Stories, Records) are plain links beside it. On a
 * phone the bar's nav is replaced by the tab bar (`PhoneTabBar`), whose Rooms tab opens the same
 * list (`RoomsList`) in a sheet.
 *
 * A native `<details>`, not a scripted popover: the bar is rendered on every
 * route including ones that have not hydrated, and a menu that needs JavaScript
 * to open is a menu that sometimes is not there.
 */

'use client';

import React, { useRef } from 'react';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { RoomsList } from './RoomsList';
import './rooms-menu.css';

void React;

export function RoomsMenu() {
  /**
   * `<details>` has no notion of "selecting an option" — a click on a `Link` inside it navigates
   * and leaves the panel exactly as open as it was, so the reader lands on the destination page
   * with the menu still hanging open over it until they click elsewhere. Closing it is a
   * navigation side effect, not something `<details>` does for free; this ref is what lets a
   * link's click handler reach up and close the disclosure it lives inside.
   */
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const closeMenu = () => {
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details className="ds-roomsmenu" ref={detailsRef}>
      <summary className="ds-roomsmenu__trigger">
        <DestinationIcon id="rooms" />
        Rooms
        <svg
          className="ds-roomsmenu__chevron"
          width="9"
          height="9"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="ds-roomsmenu__panel">
        <RoomsList onNavigate={closeMenu} />
      </div>
    </details>
  );
}
