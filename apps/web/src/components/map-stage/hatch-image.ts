import type { Map as MapLibreMap } from 'maplibre-gl';
import { brandPalette } from '@repo/ui';
import { JURISDICTION_HATCH_IMAGE_ID } from '../../app/map/explore-layer-ids';

/** The hatch tile: 10px square, one 2px diagonal sand line per tile, so tiles join into stripes. */
export const HATCH_TILE_PX = 10;

/** RGBA pixels for the hatch tile. Pure so it can be tested without a canvas. */
export function hatchPixels(size = HATCH_TILE_PX, hex: string = brandPalette.pageSand): Uint8Array {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // A 45 degree line (x + y on the tile's anti-diagonal), 2px wide, wrapping at the edge.
      const onLine = (x + y) % size < 2;
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = onLine ? 255 : 0;
    }
  }
  return data;
}

/** Adds the hatch pattern when a style asks for it (`styleimagemissing`), once per map. */
export function bindHatchImage(map: MapLibreMap): void {
  map.on('styleimagemissing', (event: { id: string }) => {
    if (event.id !== JURISDICTION_HATCH_IMAGE_ID || map.hasImage(JURISDICTION_HATCH_IMAGE_ID))
      return;
    map.addImage(JURISDICTION_HATCH_IMAGE_ID, {
      width: HATCH_TILE_PX,
      height: HATCH_TILE_PX,
      data: hatchPixels(),
    });
  });
}
