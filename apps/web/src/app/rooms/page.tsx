/**
 * `/rooms`, the index of every destination past the map: each group the footer keeps is a
 * full-bleed color block (copper, sand, ink) with its number as a display numeral, and each
 * destination a ruled row with its name set large and one line of purpose.
 *
 * Rows, group names and copy all derive from the destination registry, so no route can be
 * hand-linked or go missing. Each group is a deep-linkable section: `/rooms#read`,
 * `/rooms#check`, `/rooms#take-part`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';
import { Block, DisplayNumeral, PageHeader } from '@repo/ui';
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

/** One tone per group, in order; the copy never depends on it. */
const GROUP_TONES = ['copper', 'sand', 'ink'] as const;

export default function RoomsPage() {
  const total = ROOMS_CARD_GROUPS.reduce(
    (sum, group) => sum + destinationsInGroup(group).length,
    0,
  );
  return (
    <Room width="wide" className="ds-rooms">
      {/* The count as a giant numeral; the dek says it in words, so it is not read twice. */}
      <PageHeader
        display
        className="ds-rooms__head"
        title="Rooms"
        dek={`${total} rooms past the map, in ${ROOMS_CARD_GROUPS.length} groups.`}
        actions={
          <DisplayNumeral decorative className="ds-rooms__count">
            {total}
          </DisplayNumeral>
        }
      />

      {ROOMS_CARD_GROUPS.map((group, index) => (
        <Block
          tone={GROUP_TONES[index % GROUP_TONES.length] ?? 'ink'}
          className="ds-rooms__group"
          key={group}
          aria-labelledby={group}
        >
          <div className="ds-wrap ds-rooms__inner">
            <header className="ds-rooms__mark">
              <DisplayNumeral decorative className="ds-rooms__numeral">
                {String(index + 1).padStart(2, '0')}
              </DisplayNumeral>
              <h2 className="ds-rooms__heading" id={group}>
                {GROUP_HEADINGS[group]}
              </h2>
            </header>
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
          </div>
        </Block>
      ))}
    </Room>
  );
}
