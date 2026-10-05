/**
 * The rooms, grouped, plus the hub link. One list, two containers: the desktop bar's Rooms
 * disclosure (`RoomsMenu`) and the phone tab bar's Rooms sheet (`PhoneTabBar`). The product axes
 * (Map, Stories, Records) are never rows here — they are the bar's links on desktop and the tab
 * bar's tabs on a phone, so they are always one tap away on their own.
 */
'use client';

import React from 'react';
import Link from 'next/link';
import {
  GROUP_HEADINGS,
  ROOMS_CARD_GROUPS,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

export type RoomsListProps = {
  /** Called when a row is chosen, so the container (disclosure or sheet) can close. */
  readonly onNavigate?: () => void;
};

export function RoomsList({ onNavigate }: RoomsListProps) {
  return (
    <>
      <div className="ds-roomsmenu__rooms">
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
                  onClick={() => onNavigate?.()}
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
      <Link
        className="ds-roomsmenu__hub"
        href="/rooms"
        prefetch={false}
        onClick={() => onNavigate?.()}
      >
        <DestinationIcon id="rooms" />
        All rooms
      </Link>
    </>
  );
}
