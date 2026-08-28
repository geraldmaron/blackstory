/**
 * The Library menu — the archive's rooms, in the bar rather than behind ⌘K.
 *
 * v9 emptied the bar down to two modes and moved every destination into the palette. That was
 * right about the fourteen-item menu and wrong about the consequence: a first-time reader has no
 * reason to press ⌘K, so eleven editorial rooms were reachable only by finding the Library link
 * and then reading a second page. This is the middle position — one control in the bar that opens
 * the same list the library hub renders, from the same registry, so the two can never drift.
 *
 * A native `<details>`, not a scripted popover: the bar is rendered on every route including ones
 * that have not hydrated, and a menu that needs JavaScript to open is a menu that sometimes is not
 * there. `/library` itself stays a real link inside the panel, so the hub keeps its crawl path.
 */

'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import {
  GROUP_HEADINGS,
  LIBRARY_CARD_GROUPS,
  cardTitleFor,
  destinationFor,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import './library-menu.css';

void React;

/** The two ways into the records themselves, held out of the room lists as the panel's own column. */
const DIRECT_PATHS = ['/explore', '/records'] as const;

export type LibraryMenuProps = {
  /** Rendered on the "All records" card when the surface knows the count. */
  readonly recordCount?: number | undefined;
};

export function LibraryMenu({ recordCount }: LibraryMenuProps) {
  const direct = DIRECT_PATHS.map((path) => destinationFor(path)).filter(
    (destination): destination is NonNullable<typeof destination> => destination !== undefined,
  );

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
    <details className="ds-libmenu" ref={detailsRef}>
      <summary className="ds-libmenu__trigger">
        Library
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="ds-libmenu__panel">
        <div className="ds-libmenu__rooms">
          {LIBRARY_CARD_GROUPS.map((group) => (
            <div className="ds-libmenu__group" key={group}>
              <span className="ds-libmenu__grouphd">{GROUP_HEADINGS[group]}</span>
              <div className="ds-libmenu__list">
                {destinationsInGroup(group).map((destination) => (
                  <Link
                    className="ds-libmenu__item"
                    href={destination.path}
                    key={destination.path}
                    prefetch={false}
                    onClick={closeMenu}
                  >
                    {cardTitleFor(destination)}
                    {destination.menuLine ? <small>{destination.menuLine}</small> : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="ds-libmenu__direct">
          <span className="ds-libmenu__grouphd">Straight to the records</span>
          {direct.map((destination) => (
            <Link
              className="ds-libmenu__card"
              href={destination.path}
              key={destination.path}
              prefetch={false}
              onClick={closeMenu}
            >
              <span className="ds-libmenu__card-kind">
                {destination.path === '/explore' ? 'Map' : 'Index'}
              </span>
              <span className="ds-libmenu__card-title">
                {destination.path === '/records' && recordCount !== undefined
                  ? `All ${recordCount.toLocaleString('en-US')} records`
                  : cardTitleFor(destination)}
              </span>
              <span className="ds-libmenu__card-desc">{destination.description}</span>
            </Link>
          ))}
          <p className="ds-libmenu__foot">
            Everything here is also reachable from{' '}
            <Link href="/library" prefetch={false} onClick={closeMenu}>
              the library
            </Link>
            .
          </p>
        </div>
      </div>
    </details>
  );
}
