/**
 * Deterministic scattered mosaic placements for edition page gutters — pseudo-random
 * positions from a seed key (stable per session / page load, no layout thrash).
 */
import { hashString } from '../../atmosphere/hash';
import { selectMosaicTiles } from '../../atmosphere/select-atmosphere-plane';
import type { AtmosphereTileCredit } from '../../atmosphere/tile-credits';

export type ScatteredMosaicPlacement = {
  readonly tile: AtmosphereTileCredit;
  readonly side: 'left' | 'right';
  /** 0–1 within the gutter band (horizontal). */
  readonly gutterX: number;
  /** 0–1 vertical position within the scatter field. */
  readonly gutterY: number;
  /** Tile edge length in rem. */
  readonly sizeRem: number;
  readonly rotationDeg: number;
  readonly opacity: number;
};

export type ScatteredMosaicLayoutInput = {
  readonly seedKey: string;
  readonly count?: number;
};

function seededUnit(seedKey: string, index: number, channel: string): number {
  return (hashString(`${seedKey}:${index}:${channel}`) % 10_000) / 10_000;
}

/**
 * Pick tiles from the rights-cleared archive pool and scatter them into left/right
 * gutter bands only (center content column stays clear for WCAG opaque surfaces).
 */
export function computeScatteredMosaicLayout(
  input: ScatteredMosaicLayoutInput,
): readonly ScatteredMosaicPlacement[] {
  const count = Math.max(6, Math.min(24, Math.floor(input.count ?? 16)));
  const tiles = selectMosaicTiles(input.seedKey, count);
  const placements: ScatteredMosaicPlacement[] = [];

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]!;
    const side = seededUnit(input.seedKey, index, 'side') < 0.5 ? 'left' : 'right';
    placements.push({
      tile,
      side,
      gutterX: 0.08 + seededUnit(input.seedKey, index, 'x') * 0.82,
      gutterY: 0.06 + seededUnit(input.seedKey, index, 'y') * 0.88,
      sizeRem: 3.25 + seededUnit(input.seedKey, index, 'size') * 2.75,
      rotationDeg: (seededUnit(input.seedKey, index, 'rot') - 0.5) * 7,
      opacity: 0.055 + seededUnit(input.seedKey, index, 'op') * 0.065,
    });
  }

  return placements;
}
