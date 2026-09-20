/**
 * `/rooms` — the archive's wayfinding hub: the ways in that are not the map.
 *
 * Rooms is orientation, not immersion. It names the kinds of knowledge beyond the map and links
 * out to each room; it is never a second period-immersion surface (that is Data) or a second
 * record index (that is Records). Cards, groups, copy and the surface-class line all derive from
 * the destination registry, so no route can be hand-linked or go missing. Each group is a
 * deep-linkable band: `/rooms#read`, `/rooms#check`, `/rooms#take-part`.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  ROOMS_CARD_GROUPS,
  ROOMS_GROUP_COPY,
  cardTitleFor,
  classLabelFor,
  destinationsInGroup,
  type DestinationGroup,
} from '../../lib/nav/destination-registry';
import {
  CardGrid,
  Room,
  RoomCard,
  ReadingEntry,
  RoomJump,
  RoomSection,
  roomSectionTone,
} from '../../components/room';
import { DestinationIcon } from '../../components/patterns/DestinationIcon';
import { WalkOffRamp } from '../walk-off-ramp';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import '../reading-room.css';
import './rooms.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/rooms',
  title: 'Rooms',
  description:
    'What kinds of knowledge live beyond the map: law, data, lives across the decades, banned books, the memorial wall, the source library, the methods that keep records honest, and the ways to add to it.',
});

const GROUP_KICKER: Readonly<Record<DestinationGroup, string>> = {
  find: 'Find',
  read: 'Read the archive',
  check: 'How it decides',
  'take-part': 'Add to it',
};

const GROUP_ICON: Readonly<Record<DestinationGroup, DestinationIconId>> = {
  find: 'explore',
  read: 'collection',
  check: 'methodology',
  'take-part': 'submit',
};

export default function RoomsPage() {
  const jump = ROOMS_CARD_GROUPS.map((group) => ({
    id: group,
    label: ROOMS_GROUP_COPY[group].heading ?? GROUP_KICKER[group],
    icon: GROUP_ICON[group],
  }));

  return (
    <Room ledger>
      <ReadingEntry
        pathname="/rooms"
        title={
          <>
            The ways in that are not the <em>map</em>.
          </>
        }
        lede="Rooms is how you read the archive without the map. Each one is a different kind of knowledge: how to read it, how it decides what to trust, and how to add to what is missing."
        showCrumb={false}
      />

      <RoomJump sections={jump} label="The rooms on this page" />

      {ROOMS_CARD_GROUPS.map((group, index) => {
        const copy = ROOMS_GROUP_COPY[group];
        return (
          <RoomSection
            key={group}
            id={group}
            icon={GROUP_ICON[group]}
            kicker={GROUP_KICKER[group]}
            title={copy.heading ?? GROUP_KICKER[group]}
            tone={roomSectionTone(index)}
          >
            {copy.standfirst ? (
              <p className="ds-rooms-band__standfirst">{copy.standfirst}</p>
            ) : null}
            <CardGrid>
              {destinationsInGroup(group).map((destination) => (
                <RoomCard
                  key={destination.path}
                  href={destination.path}
                  kind={destination.kind ?? ''}
                  title={
                    <>
                      <DestinationIcon id={destination.icon} className="ds-rooms-card__glyph" />
                      {cardTitleFor(destination)}
                    </>
                  }
                  description={destination.description}
                  tag={classLabelFor(destination)}
                />
              ))}
            </CardGrid>
          </RoomSection>
        );
      })}

      <WalkOffRamp>
        These rooms are the archive&apos;s. They do not invent a join to one place.
      </WalkOffRamp>
    </Room>
  );
}
