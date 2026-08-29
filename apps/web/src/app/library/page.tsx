/**
 * `/library` — the rooms, listed so a reader can choose one.
 *
 * Cards come from `lib/nav/destination-registry.ts`, never hand-written.
 * The way back is the place the reader left, the same door every other
 * room on the walk uses. Atlas and the record index stay off this page.
 */
import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  GROUP_HEADINGS,
  LIBRARY_CARD_GROUPS,
  cardTitleFor,
  destinationsInGroup,
} from '../../lib/nav/destination-registry';
import { CardGrid, GroupHeading, Room, RoomCard, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import '../reading-room.css';

void React;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/library',
  title: 'The library',
  description:
    'Chapters, law, data, challenged titles, the memorial, and the receipts that show how a record gets in.',
});

/**
 * The registry stores kinds in the v6 mono-caps register (`LONG FORM`, `CATALOGUE`). The rows
 * print them as a quiet right-hand tag, where caps would shout across every row, so they are
 * cased here rather than rewritten in the registry — the mobile app and the palette still read
 * the same field.
 */
function sentenceCase(kind: string): string {
  return kind.charAt(0) + kind.slice(1).toLowerCase();
}

export default function LibraryPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/library"
        kicker="Rooms"
        title="The library"
        lede="Chapters, law, data, challenged titles, the memorial, and the receipts that show how a record gets in."
        showPath={false}
      />

      {LIBRARY_CARD_GROUPS.map((group) => (
        <React.Fragment key={group}>
          <GroupHeading>{GROUP_HEADINGS[group]}</GroupHeading>
          <CardGrid>
            {destinationsInGroup(group).map((destination) => (
              <RoomCard
                key={destination.path}
                href={destination.path}
                kind={destination.kind ?? ''}
                title={cardTitleFor(destination)}
                description={destination.description}
                {...(destination.kind ? { tag: sentenceCase(destination.kind) } : {})}
              />
            ))}
          </CardGrid>
        </React.Fragment>
      ))}

      <WalkOffRamp>
        These rooms are the archive's. They do not invent a join to one place.
      </WalkOffRamp>
    </Room>
  );
}
