/**
 * Memorial v6 edition: full-canvas handwritten name wall with an opaque Surface
 * stack carrying the readable alphabetical list. No photo mosaic.
 *
 * Must stay dynamic: entity-link matching reads the live public entity
 * catalog (listPublicEntityViews), and App Hosting mounts DATABASE_URL at
 * runtime only — a build-time static page would bake an empty/seed catalog
 * into production (same reasoning as sitemap.ts).
 */

import { matchMemorialNamesToEntities } from '../../components/patterns/memorial-wall/memorial-entity-links';
import { MemorialWallAtmosphere } from '../../components/patterns/memorial-wall/MemorialWallAtmosphere';
import { MEMORIAL_NAMES } from '../../components/patterns/memorial-wall/memorial-names';
import { listPublicEntityViews } from '../../lib/public-data/source';
import { MemorialSections } from './MemorialSections';
import {
  MEMORIAL_HELD_MESSAGE_LINES,
  MEMORIAL_PAGE_DESCRIPTION,
  MEMORIAL_PAGE_TITLE,
} from './memorial-copy';
import {
  MEMORIAL_EDITION_WALL_SEED,
  memorialEditionRootClassName,
  memorialEditionStackClassName,
} from './memorial-panel-chrome';
import './memorial-edition.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: MEMORIAL_PAGE_TITLE,
  description: MEMORIAL_PAGE_DESCRIPTION,
};

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
      <main className="ds-container ds-page" id="main">
        <div className={memorialEditionStackClassName()}>
          <MemorialSections entityLinksByName={entityLinksByName} />
        </div>
      </main>
    </div>
  );
}
