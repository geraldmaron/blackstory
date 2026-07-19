/**
 * Curated tile list for the missing-image archive collage.
 * Paths are local copies under /brand/collage/tiles — rights-cleared
 * Commons promotions (see scripts/build-archive-collage-tiles.ts).
 */
import { hashString } from './archive-collage';

export const ARCHIVE_COLLAGE_TILES = [
  '/brand/collage/tiles/01.jpg',
  '/brand/collage/tiles/02.jpg',
  '/brand/collage/tiles/03.jpg',
  '/brand/collage/tiles/04.jpg',
  '/brand/collage/tiles/05.jpg',
  '/brand/collage/tiles/06.jpg',
  '/brand/collage/tiles/07.jpg',
  '/brand/collage/tiles/08.jpg',
  '/brand/collage/tiles/09.jpg',
  '/brand/collage/tiles/10.jpg',
  '/brand/collage/tiles/11.jpg',
  '/brand/collage/tiles/12.jpg',
  '/brand/collage/tiles/13.jpg',
  '/brand/collage/tiles/14.jpg',
  '/brand/collage/tiles/15.jpg',
  '/brand/collage/tiles/16.jpg',
  '/brand/collage/tiles/17.jpg',
  '/brand/collage/tiles/18.jpg',
  '/brand/collage/tiles/19.jpg',
  '/brand/collage/tiles/20.jpg',
  '/brand/collage/tiles/21.jpg',
  '/brand/collage/tiles/22.jpg',
  '/brand/collage/tiles/23.jpg',
  '/brand/collage/tiles/24.jpg',
] as const;

/** Rotate the tile window so different entities show different mosaics. */
export function collageTilesForEntity(entityId: string): readonly string[] {
  const start = hashString(`tiles:${entityId}`) % ARCHIVE_COLLAGE_TILES.length;
  const out: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    out.push(ARCHIVE_COLLAGE_TILES[(start + i) % ARCHIVE_COLLAGE_TILES.length]!);
  }
  return out;
}
