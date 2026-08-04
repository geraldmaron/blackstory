/**
 * Archive mosaic credits: lists the rights-cleared collage tiles used as
 * decorative atmosphere on story pages and the about-page living mosaic.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import Link from 'next/link';
import { ATMOSPHERE_TILE_CREDITS } from '../../../components/atmosphere';
import {
  DataTable,
  GroupHeading,
  OffRamp,
  Prose,
  Room,
  RoomHeader,
} from '../../../components/room';
import '../../utility.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/chapters/mosaic-credits',
  title: 'Archive mosaic credits',
  description:
    'Source credits for the rights-cleared archive mosaic tiles used as symbolic atmosphere on BlackStory story and about pages.',
});

export default function MosaicCreditsPage() {
  return (
    <Room>
      <RoomHeader
        pathname="/chapters/mosaic-credits"
        kicker="Attribution"
        title={
          <>
            Archive mosaic <em>credits</em>
          </>
        }
        lede="Story pages may show a soft black-and-white mosaic in the page gutters. Those tiles are rights-cleared archive images, served from this site (never hotlinked from Wikimedia at request time). The mosaic is symbolic atmosphere, not a photograph of a page subject."
      />

      <GroupHeading>{ATMOSPHERE_TILE_CREDITS.length} curated tiles</GroupHeading>
      <Prose>
        <p>
          Each tile maps to a published entity primary image (GCS public-media). Rebuild the local
          pool with the collage tile script when the Commons promote set changes.
        </p>
      </Prose>
      <DataTable
        caption="Archive mosaic tile pool: index, source entity and stored path"
        columns={[
          { key: 'index', label: 'Tile', numeric: true },
          { key: 'entity', label: 'Entity' },
          { key: 'path', label: 'Path' },
        ]}
        rows={ATMOSPHERE_TILE_CREDITS.map((tile) => ({
          index: tile.index,
          entity: <Link href={`/entity/${tile.entityId}`}>{tile.entityId}</Link>,
          path: <span className="ds-mono">{tile.path}</span>,
        }))}
      />

      <OffRamp
        title="Keep reading"
        actions={[
          { href: '/chapters', label: 'All chapters', emphasis: 'copper' },
          { href: '/about', label: 'About the archive' },
        ]}
      >
        These tiles are atmosphere. The chapters they sit behind are the account.
      </OffRamp>
    </Room>
  );
}
