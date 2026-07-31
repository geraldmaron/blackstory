/**
 * Memorial — a living memorial wall of names held in remembrance.
 *
 * Must stay dynamic: entity-link matching reads the live public entity
 * catalog (listPublicEntityViews), and App Hosting mounts DATABASE_URL at
 * runtime only — a build-time static page would bake an empty/seed catalog
 * into production (same reasoning as sitemap.ts).
 *
 * Converted to the v9 room kit (SP-22). Renders through Room, RoomHeader,
 * Prose, and OffRamp with the standard reading-room design language. The
 * MemorialWallAtmosphere (handwritten names canvas) remains the background
 * layer; MemorialSections renders the accessible list and quiet navigation.
 */

import type { Metadata } from 'next';
import React from 'react';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { matchMemorialNamesToEntities } from '../../components/patterns/memorial-wall/memorial-entity-links';
import { MemorialWallAtmosphere } from '../../components/patterns/memorial-wall/MemorialWallAtmosphere';
import { MEMORIAL_NAMES } from '../../components/patterns/memorial-wall/memorial-names';
import { listPublicEntityViews } from '../../lib/public-data/source';
import { OffRamp, Prose, Room, RoomHeader } from '../../components/room';
import { MemorialSections } from './MemorialSections';
import {
  MEMORIAL_HELD_MESSAGE_LINES,
  MEMORIAL_INTRO_PARAGRAPHS,
  MEMORIAL_KICKER,
  MEMORIAL_LEDE,
  MEMORIAL_PAGE_DESCRIPTION,
  MEMORIAL_PAGE_TITLE,
} from './memorial-copy';
import { MEMORIAL_EDITION_WALL_SEED, memorialEditionRootClassName } from './memorial-panel-chrome';
import '../reading-room.css';
import './memorial-edition.css';

void React;

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/memorial',
  title: MEMORIAL_PAGE_TITLE,
  description: MEMORIAL_PAGE_DESCRIPTION,
});

export default async function MemorialPage() {
  const { data: entities } = await listPublicEntityViews();
  const entityLinksByName = Object.fromEntries(
    matchMemorialNamesToEntities(
      MEMORIAL_NAMES,
      entities.map((entity) => ({ id: entity.id, displayName: entity.displayName })),
    ),
  );

  return (
    <div className={memorialEditionRootClassName()} data-memorial-edition="v6">
      <MemorialWallAtmosphere
        seedKey={MEMORIAL_EDITION_WALL_SEED}
        messageLines={MEMORIAL_HELD_MESSAGE_LINES}
        entityLinksByName={entityLinksByName}
      />
      <Room>
        <RoomHeader
          pathname="/memorial"
          kicker={MEMORIAL_KICKER}
          title={MEMORIAL_PAGE_TITLE}
          lede={MEMORIAL_LEDE}
        />

        <Prose>
          {MEMORIAL_INTRO_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </Prose>

        <MemorialSections entityLinksByName={entityLinksByName} />

        <OffRamp
          title="Go from here"
          actions={[
            { label: 'Open the Atlas', href: '/', emphasis: 'copper' },
            { label: 'Read the index', href: '/records' },
          ]}
        >
          The map places what can be placed and the index lists everything. These rooms hold the
          context: how records get in, how confidence is measured, and which pieces speak to each
          other.
        </OffRamp>
      </Room>
    </div>
  );
}
