/**
 * Memorial — a living memorial wall of names held in remembrance.
 *
 * Names stay names. This is the national memorial, not a join from this
 * place's record, and wall names do not follow `/entity/ent_…`.
 *
 * Converted to the v9 room kit (SP-22). Renders through Room, RoomHeader and
 * OffRamp with the standard reading-room design language. The
 * MemorialWallAtmosphere (handwritten names canvas) is the background layer;
 * MemorialSections renders the accessible list.
 *
 * The opening screen is the wall plus a bare kicker/title and one quiet link
 * down to the list. No lede, no intro prose, no message assembling out of the
 * handwriting: the room-kit conversion left those stacked on top of the wall,
 * which is what made the first viewport read as clutter. The full list starts
 * below the fold (`__opening` reserves the opening viewport) and is reached by
 * scrolling.
 */

import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { MemorialWallAtmosphere } from '../../components/patterns/memorial-wall/MemorialWallAtmosphere';
import { Room, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { MemorialSections } from './MemorialSections';
import { MemorialScrollCue } from './MemorialScrollCue';
import {
  MEMORIAL_HELD_MESSAGE_LINES,
  MEMORIAL_KICKER,
  MEMORIAL_PAGE_LEDE,
  MEMORIAL_PAGE_DESCRIPTION,
  MEMORIAL_PAGE_TITLE,
  MEMORIAL_QUIET_LIST_LINK_A11Y_LABEL,
  MEMORIAL_QUIET_LIST_LINK_LABEL,
} from './memorial-copy';
import { MEMORIAL_EDITION_WALL_SEED, memorialEditionRootClassName } from './memorial-panel-chrome';
import '../reading-room.css';
import './memorial-edition.css';

void React;

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/memorial',
  title: MEMORIAL_PAGE_TITLE,
  description: MEMORIAL_PAGE_DESCRIPTION,
});

export default function MemorialPage() {
  return (
    <div className={memorialEditionRootClassName()} data-memorial-edition="v6">
      <MemorialWallAtmosphere
        seedKey={MEMORIAL_EDITION_WALL_SEED}
        messageLines={MEMORIAL_HELD_MESSAGE_LINES}
        entityLinksByName={{}}
      />
      {/* Positioned by MemorialWallAtmosphere at runtime, anchored to the held
          message's actual measured bottom edge — a sibling of the wall (not
          nested in the opening column) so it shares the wall's coordinate
          frame. Kept as a real, keyboard-reachable link; the wall itself
          stays aria-hidden. */}
      <MemorialScrollCue
        targetId="memorial-names"
        label={MEMORIAL_QUIET_LIST_LINK_LABEL}
        accessibleLabel={MEMORIAL_QUIET_LIST_LINK_A11Y_LABEL}
        className="ds-memorial-edition__scroll-cue"
      />
      <Room>
        <div className="ds-memorial-edition__opening">
          <RoomHeader
            pathname="/memorial"
            kicker={MEMORIAL_KICKER}
            title={MEMORIAL_PAGE_TITLE}
            lede={MEMORIAL_PAGE_LEDE}
            showPath={false}
          />
        </div>

        <MemorialSections />

        <WalkOffRamp title="The place">
          Names, held quietly. This is the national memorial, not one library&apos;s list.
        </WalkOffRamp>
      </Room>
    </div>
  );
}
