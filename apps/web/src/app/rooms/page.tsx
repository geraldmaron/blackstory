/**
 * `/rooms` — knowledge hub beyond the map (v10 Rooms Hub).
 *
 * Cards come from `lib/nav/destination-registry.ts`, never hand-written.
 * One column of destinations reads as a table of contents, not a settings menu.
 * The way back is the same walk off-ramp every other room uses.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  ROOMS_CARD_GROUPS,
  ROOMS_GROUP_COPY,
  cardTitleFor,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import { CardGrid, GroupHeading, Room, RoomCard, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import '../reading-room.css';
import './rooms.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/rooms',
  title: 'Rooms',
  description:
    'What kinds of knowledge live beyond the map: stories, law, data, memorial, and the methods that keep records honest.',
});

export default function RoomsPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/rooms"
        kicker="Beyond the map"
        title="Rooms"
        lede="What kinds of knowledge live beyond the map. Each room below is a different way into the archive."
        showPath={false}
      />

      {ROOMS_CARD_GROUPS.map((group) => {
        const copy = ROOMS_GROUP_COPY[group];
        return (
          <section key={group} className="ds-rooms-group" aria-labelledby={`rooms-`}>
            <GroupHeading>
              <span id={`rooms-`}>{copy.heading}</span>
            </GroupHeading>
            {copy.standfirst ? (
              <p className="ds-rooms-group__standfirst">{copy.standfirst}</p>
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
