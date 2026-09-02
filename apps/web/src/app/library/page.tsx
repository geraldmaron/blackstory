/**
 * `/library` — knowledge hub beyond the map (v10 Library Hub).
 *
 * Cards come from `lib/nav/destination-registry.ts`, never hand-written.
 * One column of destinations reads as a table of contents, not a settings menu.
 * The way back is the same walk off-ramp every other room uses.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  LIBRARY_CARD_GROUPS,
  LIBRARY_GROUP_COPY,
  cardTitleFor,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import { CardGrid, GroupHeading, Room, RoomCard, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import '../reading-room.css';
import './library.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/library',
  title: 'The library',
  description:
    'What kinds of knowledge live beyond the map: stories, law, data, memorial, and the methods that keep records honest.',
});

export default function LibraryPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/library"
        kicker="Beyond the map"
        title="The library"
        lede="What kinds of knowledge live beyond the map. Each room below is a different way into the archive."
        showPath={false}
      />

      {LIBRARY_CARD_GROUPS.map((group) => {
        const copy = LIBRARY_GROUP_COPY[group];
        return (
          <section key={group} className="ds-library-group" aria-labelledby={`library-${group}`}>
            <GroupHeading>
              <span id={`library-${group}`}>{copy.heading}</span>
            </GroupHeading>
            {copy.standfirst ? (
              <p className="ds-library-group__standfirst">{copy.standfirst}</p>
            ) : null}
            <CardGrid>
              {destinationsInGroup(group).map((destination) => (
                <RoomCard
                  key={destination.path}
                  href={destination.path}
                  kind={destination.kind ?? ''}
                  title={cardTitleFor(destination)}
                  description={destination.description}
                />
              ))}
            </CardGrid>
          </section>
        );
      })}

      <WalkOffRamp>
        These rooms are the archive's. They do not invent a join to one place.
      </WalkOffRamp>
    </Room>
  );
}
