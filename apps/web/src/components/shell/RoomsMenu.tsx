/**
 * The Rooms axis in the command bar: a disclosure listing the supporting rooms, plus a link to
 * the hub itself. The three other axes (Explore, Stories, Records) are plain links beside it.
 *
 * The axes never appear inside the panel on wide layouts — Rooms lists the rooms, and an axis
 * listed as an ordinary room row is how Records once read as a supporting page. On phone map
 * surfaces, Stories and Records fold here as Find overflow so the bar stays Map + Rooms.
 *
 * A native `<details>`, not a scripted popover: the bar is rendered on every
 * route including ones that have not hydrated, and a menu that needs JavaScript
 * to open is a menu that sometimes is not there.
 */

'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import {
  GROUP_HEADINGS,
  ROOMS_CARD_GROUPS,
  destinationsInGroup,
  primaryNavDestinations,
} from '../../lib/nav/destination-registry';
import { DestinationIcon } from '../patterns/DestinationIcon';
import './rooms-menu.css';

void React;

/** Stories and Records — the axes that leave the phone Find pill on map surfaces. */
const OVERFLOW_FIND_PATHS = new Set(['/stories', '/records']);

export type RoomsMenuProps = {
  /**
   * When true (phone width on `/` or `/explore`), surface Stories and Records at the top of the
   * panel so they remain reachable after leaving the Find pill.
   */
  readonly overflowFind?: boolean;
};

export function RoomsMenu({ overflowFind = false }: RoomsMenuProps) {
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

  const overflowAxes = overflowFind
    ? primaryNavDestinations().filter((axis) => OVERFLOW_FIND_PATHS.has(axis.path))
    : [];

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
        <div className="ds-roomsmenu__rooms">
          {overflowAxes.length > 0 ? (
            <div className="ds-roomsmenu__group">
              <span className="ds-roomsmenu__grouphd">Find</span>
              <div className="ds-roomsmenu__list">
                {overflowAxes.map((axis) => (
                  <Link
                    className="ds-roomsmenu__item"
                    href={axis.path}
                    key={axis.path}
                    prefetch={false}
                    onClick={closeMenu}
                  >
                    <DestinationIcon id={axis.icon} />
                    <span className="ds-roomsmenu__copy">{axis.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {ROOMS_CARD_GROUPS.map((group) => (
            <div className="ds-roomsmenu__group" key={group}>
              <span className="ds-roomsmenu__grouphd">{GROUP_HEADINGS[group]}</span>
              <div className="ds-roomsmenu__list">
                {destinationsInGroup(group).map((destination) => (
                  <Link
                    className="ds-roomsmenu__item"
                    href={destination.path}
                    key={destination.path}
                    prefetch={false}
                    onClick={closeMenu}
                  >
                    <DestinationIcon id={destination.icon} />
                    <span className="ds-roomsmenu__copy">
                      {destination.label}
                      {destination.menuLine ? <small>{destination.menuLine}</small> : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* The hub itself. Without it `/rooms` was reachable from the footer and the breadcrumb
            chain but from nothing in the bar, even though the control is named after it. */}
        <Link className="ds-roomsmenu__hub" href="/rooms" prefetch={false} onClick={closeMenu}>
          <DestinationIcon id="rooms" />
          All rooms
        </Link>
      </div>
    </details>
  );
}
