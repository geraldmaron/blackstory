/**
 * Memorial — a living memorial wall of names held in remembrance.
 *
 * Names stay names. This is the national memorial, not a join from this
 * place's record, and wall names do not follow `/entity/ent_…`.
 *
 * Converted to the v9 room kit (SP-22). Renders through Room and OffRamp. The
 * MemorialWallAtmosphere (handwritten names canvas) is the opening field;
 * MemorialSections renders the accessible list below the fold.
 *
 * The first screen is the wall and one quiet link down to the list. No title,
 * lede, or intro prose over the names. `__opening` reserves the opening
 * viewport so the list starts below the fold.
 */

import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { MemorialWallSection } from '../../components/patterns/memorial-wall/MemorialWallAtmosphere';
import { Room } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { MemorialSections } from './MemorialSections';
import { MemorialScrollCue } from './MemorialScrollCue';
import {
  MEMORIAL_HELD_MESSAGE_LINES,
  MEMORIAL_PAGE_DESCRIPTION,
  MEMORIAL_QUIET_LIST_LINK_A11Y_LABEL,
  MEMORIAL_QUIET_LIST_LINK_LABEL,
  MEMORIAL_WALL_SEED,
} from './memorial-copy';
import '../reading-room.css';

void React;

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/memorial',
  title: 'Memorial',
  description: MEMORIAL_PAGE_DESCRIPTION,
});

export default function MemorialPage() {
  return (
    <div className="ds-memorial">
      <MemorialWallSection
        seedKey={MEMORIAL_WALL_SEED}
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
        className="ds-memorial__scroll-cue"
      />
      <Room>
        <div className="ds-memorial__opening" />

        <MemorialSections />

        <WalkOffRamp title="This wall is national">
          It isn't drawn from any one place's record. Each name stands on its own here, not as a
          link to a page.
        </WalkOffRamp>
      </Room>
    </div>
  );
}
