/** Decorative mosaic sources: source-backed names, honest current-image credits and native paging. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, Pagination } from '@repo/ui';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { ATMOSPHERE_TILE_CREDITS } from '../../../components/atmosphere';
import { getPublicSearchIndex } from '../../../lib/public-data/source';
import { OffRamp, Prose, Room, ReadingEntry } from '../../../components/room';
import {
  MOSAIC_CREDITS_PAGE_SIZE,
  mosaicCreditsPage,
  mosaicCreditsHref,
  mosaicCreditRow,
} from './credit-model';
import '../../utility.css';
import './mosaic-credits.css';

type Props = { readonly searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page } = mosaicCreditsPage((await searchParams)?.page, ATMOSPHERE_TILE_CREDITS.length);
  return buildStaticPageMetadata({
    path: mosaicCreditsHref(page),
    title: 'Archive mosaic credits',
    description:
      'The decorative archive images, their associated records and current source information.',
  });
}

export default async function MosaicCreditsPage({ searchParams }: Props = {}) {
  const { page, pageCount, start } = mosaicCreditsPage(
    (await searchParams)?.page,
    ATMOSPHERE_TILE_CREDITS.length,
  );
  const tiles = ATMOSPHERE_TILE_CREDITS.slice(start, start + MOSAIC_CREDITS_PAGE_SIZE);
  // Credit labels need names, not hundreds of hydrated claim/relationship projections.
  const read = await getPublicSearchIndex().catch(() => ({ data: [], source: 'failed' as const }));
  const records = new Map(read.data.map((record) => [record.id, record]));

  return (
    <Room>
      <ReadingEntry
        pathname="/stories/mosaic-credits"
        title={
          <>
            Archive mosaic <em>credits</em>
          </>
        }
        lede="These decorative archive images provide atmosphere. They do not depict the subject of every chapter. Each tile below links to the record associated with it."
      />
      <Prose>
        <p>
          This list records an image address and an associated record for each tile. Open the record
          to read its current image credit. Separate credits for the copied tiles are not recorded
          in this list.
        </p>
      </Prose>
      {read.source !== 'live' ? (
        <Notice tone="warning" title="Record information could not be loaded">
          The tiles and their recorded image links are available below. Reload to try the record
          information again.
        </Notice>
      ) : null}
      <div className="ds-mosaic-credits">
        {tiles.map((tile) => {
          const row = mosaicCreditRow(tile, records.get(tile.entityId));
          return (
            <article
              className="ds-mosaic-credit"
              key={tile.index}
              aria-labelledby={`mosaic-credit-${tile.index}`}
            >
              {/* Local derivatives are the actual decorative assets, not the current record image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.tilePath} width={96} height={96} loading="lazy" alt="" />
              <div>
                <p className="ds-mosaic-credit__index">Tile {row.index}</p>
                <h2 id={`mosaic-credit-${tile.index}`}>
                  {row.recordHref ? (
                    <Link href={row.recordHref}>{row.name}</Link>
                  ) : (
                    'Associated record unavailable'
                  )}
                </h2>
                <p className="ds-mosaic-credit__note">
                  Separate copied-tile credit not recorded here.
                </p>
                {row.recordedImageHref ? (
                  <a
                    className="ds-mosaic-credit__source"
                    href={row.recordedImageHref}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    Recorded image
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        pageSize={MOSAIC_CREDITS_PAGE_SIZE}
        total={ATMOSPHERE_TILE_CREDITS.length}
        itemLabel="tiles"
        hrefForPage={mosaicCreditsHref}
      />
      <OffRamp
        title="Keep reading"
        actions={[
          { href: '/stories', label: 'All stories', emphasis: 'copper' },
          { href: '/about', label: 'About the archive' },
        ]}
      >
        The mosaic is atmosphere. The chapters carry the account.
      </OffRamp>
    </Room>
  );
}
