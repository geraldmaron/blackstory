/**
 * `/rooms`, the plain index of everything that is not the map: one ruled row per destination,
 * its name and one line of purpose, grouped the way the footer groups them.
 *
 * Rows, group names and copy all derive from the destination registry, so no route can be
 * hand-linked or go missing. Each group is a deep-linkable section: `/rooms#read`,
 * `/rooms#check`, `/rooms#take-part`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { PageHeader } from '@repo/ui';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  GROUP_HEADINGS,
  ROOMS_CARD_GROUPS,
  cardTitleFor,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import { Room } from '../../components/room';
import '../reading-room.css';
import './rooms.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/rooms',
  title: 'Rooms',
  description:
    'What kinds of knowledge live beyond the map: law, data, lives across the decades, banned books, the memorial wall, the source library, the methods that keep records honest, and the ways to add to it.',
});

function ArrowGlyph() {
  return (
    <svg className="ds-rooms__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h9.5m0 0L8.5 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RoomsPage() {
  return (
    <Room width="wide" className="ds-rooms">
      <PageHeader title="Rooms" />

      {ROOMS_CARD_GROUPS.map((group) => (
        <section className="ds-rooms__group" key={group} aria-labelledby={group}>
          <h2 className="ds-rooms__heading" id={group}>
            {GROUP_HEADINGS[group]}
          </h2>
          <ul className="ds-rooms__list">
            {destinationsInGroup(group).map((destination) => (
              <li key={destination.path}>
                <Link className="ds-rooms__row" href={destination.path}>
                  <span className="ds-rooms__name">{cardTitleFor(destination)}</span>
                  {destination.description ? (
                    <span className="ds-rooms__purpose">{destination.description}</span>
                  ) : null}
                  <ArrowGlyph />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Room>
  );
}
