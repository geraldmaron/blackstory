/**
 * Deterministic scattered mosaic placements for edition page gutters — pseudo-random
 * polaroid positions from a seed key (stable per session / page load, no layout thrash).
 * Reuses the rights-cleared tile pool with varied crop and rotation for dense gutter scatter.
 */
import { ATMOSPHERE_TILE_CREDITS } from '../../atmosphere/tile-credits';
import { hashString } from '../../atmosphere/hash';
import type { AtmosphereTileCredit } from '../../atmosphere/tile-credits';

export type ScatteredMosaicPlacement = {
  readonly placementIndex: number;
  readonly tile: AtmosphereTileCredit;
  readonly side: 'left' | 'right';
  /** 0–1 within the gutter band (horizontal). */
  readonly gutterX: number;
  /** 0–1 vertical position within the scatter field. */
  readonly gutterY: number;
  /** Polaroid frame width in rem. */
  readonly widthRem: number;
  /** Polaroid frame height in rem (portrait, includes bottom caption pad). */
  readonly heightRem: number;
  readonly rotationDeg: number;
  readonly opacity: number;
  /** CSS object-position for varied crops when tiles repeat. */
  readonly objectPosition: string;
};

export type ScatteredMosaicLayoutInput = {
  readonly seedKey: string;
  readonly count?: number;
};

const MIN_PLACEMENTS = 12;
const MAX_PLACEMENTS = 96;

function seededUnit(seedKey: string, index: number, channel: string): number {
  return (hashString(`${seedKey}:${index}:${channel}`) % 10_000) / 10_000;
}

function pickTileForPlacement(seedKey: string, index: number): AtmosphereTileCredit {
  const pool = ATMOSPHERE_TILE_CREDITS;
  if (pool.length === 0) {
    throw new Error('ATMOSPHERE_TILE_CREDITS is empty');
  }
  const tileIndex = hashString(`${seedKey}:${index}:tile`) % pool.length;
  return pool[tileIndex]!;
}

/**
 * Pick tiles from the rights-cleared archive pool and scatter polaroid frames into left/right
 * gutter bands only (center content column stays clear for WCAG opaque surfaces).
 */
export function computeScatteredMosaicLayout(
  input: ScatteredMosaicLayoutInput,
): readonly ScatteredMosaicPlacement[] {
  const count = Math.max(
    MIN_PLACEMENTS,
    Math.min(MAX_PLACEMENTS, Math.floor(input.count ?? 56)),
  );
  const placements: ScatteredMosaicPlacement[] = [];

  for (let index = 0; index < count; index += 1) {
    const tile = pickTileForPlacement(input.seedKey, index);
    const side = seededUnit(input.seedKey, index, 'side') < 0.5 ? 'left' : 'right';
    const widthRem = 3.1 + seededUnit(input.seedKey, index, 'width') * 2.4;
    const heightRem = widthRem * (1.18 + seededUnit(input.seedKey, index, 'height') * 0.14);
    const objectX = 12 + seededUnit(input.seedKey, index, 'objx') * 76;
    const objectY = 8 + seededUnit(input.seedKey, index, 'objy') * 84;

    placements.push({
      placementIndex: index,
      tile,
      side,
      gutterX: 0.04 + seededUnit(input.seedKey, index, 'x') * 0.9,
      gutterY: 0.02 + seededUnit(input.seedKey, index, 'y') * 0.94,
      widthRem,
      heightRem,
      rotationDeg: (seededUnit(input.seedKey, index, 'rot') - 0.5) * 14,
      opacity: 0.16 + seededUnit(input.seedKey, index, 'op') * 0.14,
      objectPosition: `${objectX.toFixed(1)}% ${objectY.toFixed(1)}%`,
    });
  }

  return placements;
}
