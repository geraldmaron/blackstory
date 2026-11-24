/**
 * Memorial — a living memorial wall of names held in remembrance.
 *
 * Names stay names. This is the national memorial, not a join from this
 * place's record, and wall names do not follow `/entity/ent_…`.
 *
 * The page's masthead is the MemorialWallAtmosphere: a full screen of handwritten names at
 * several depths, one name at a time brought forward, and the inscription at its foot. Scrolling
 * steps closer: the wall dims as the list (MemorialSections, the complete accessible path to every
 * name) rises over it. No title or lede over the names, and no controls on the opening screen.
 * The wall sits inside `<main>` so the inscription, which is real text, is inside a landmark.
 */

import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { MemorialWallSection } from '../../components/patterns/memorial-wall/MemorialWallAtmosphere';
import { PageFrame } from '../../components/page';
import { WalkOffRamp } from '../walk-off-ramp';
import { MemorialSections } from './MemorialSections';
import {
  MEMORIAL_HELD_MESSAGE_LINES,
  MEMORIAL_PAGE_DESCRIPTION,
  MEMORIAL_WALL_SEED,
} from './memorial-copy';
import '../reading-page.css';

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
      <PageFrame
        masthead={
          <MemorialWallSection
            seedKey={MEMORIAL_WALL_SEED}
            messageLines={MEMORIAL_HELD_MESSAGE_LINES}
            entityLinksByName={{}}
          />
        }
      >
        <MemorialSections />

        <WalkOffRamp title="This wall is national">
          It isn't drawn from any one place's record. Each name stands on its own here, not as a
          link to a page.
        </WalkOffRamp>
      </PageFrame>
    </div>
  );
}
