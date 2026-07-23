/**
 * Deterministic scattered mosaic placements for edition page gutters — pseudo-random
 * polaroid positions from a seed key (stable per session / page load, no layout thrash).
 * Reuses the rights-cleared tile pool with varied crop and rotation. Frames never overlap:
 * each side is packed with AABB collision checks (rotation-expanded) before accept.
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

const MIN_PLACEMENTS = 8;
const MAX_PLACEMENTS = 96;
/** Nominal gutter width for packing math (matches wide desktop gutters). */
const ASSUMED_GUTTER_WIDTH_REM = 13;
/** Nominal viewport height for packing math (fixed mosaic is viewport-bound). */
const ASSUMED_VIEWPORT_HEIGHT_REM = 56;
/** Minimum gap between polaroid AABBs in rem. */
const BOX_GAP_REM = 0.28;
const MAX_ATTEMPTS_PER_TILE = 180;
const EDGE_PAD_FRAC = 0.015;

type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

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

function rotatedBounds(width: number, height: number, rotationDeg: number): {
  width: number;
  height: number;
} {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

function boxFromCenter(cx: number, cy: number, width: number, height: number): Box {
  return {
    left: cx - width / 2,
    top: cy - height / 2,
    right: cx + width / 2,
    bottom: cy + height / 2,
  };
}

function boxesOverlap(a: Box, b: Box, gap: number): boolean {
  return !(
    a.right + gap <= b.left ||
    a.left >= b.right + gap ||
    a.bottom + gap <= b.top ||
    a.top >= b.bottom + gap
  );
}

/**
 * Pick tiles from the rights-cleared archive pool and scatter polaroid frames into left/right
 * gutter bands only (center content column stays clear for WCAG opaque surfaces).
 * Placements are collision-packed so frames never overlap within a gutter.
 */
export function computeScatteredMosaicLayout(
  input: ScatteredMosaicLayoutInput,
): readonly ScatteredMosaicPlacement[] {
  const targetCount = Math.max(
    MIN_PLACEMENTS,
    Math.min(MAX_PLACEMENTS, Math.floor(input.count ?? 56)),
  );
  const placements: ScatteredMosaicPlacement[] = [];
  const placedBySide: { left: Box[]; right: Box[] } = { left: [], right: [] };
  const gapX = BOX_GAP_REM / ASSUMED_GUTTER_WIDTH_REM;
  const gapY = BOX_GAP_REM / ASSUMED_VIEWPORT_HEIGHT_REM;

  // Attempt more candidates than target so packing can still hit density.
  const candidateBudget = targetCount * 4;

  for (let index = 0; index < candidateBudget && placements.length < targetCount; index += 1) {
    const tile = pickTileForPlacement(input.seedKey, index);
    const side = seededUnit(input.seedKey, index, 'side') < 0.5 ? 'left' : 'right';
    const widthRem = 2.35 + seededUnit(input.seedKey, index, 'width') * 1.45;
    const heightRem = widthRem * (1.16 + seededUnit(input.seedKey, index, 'height') * 0.12);
    const rotationDeg = (seededUnit(input.seedKey, index, 'rot') - 0.5) * 10;
    const boundsRem = rotatedBounds(widthRem, heightRem, rotationDeg);
    const boxW = boundsRem.width / ASSUMED_GUTTER_WIDTH_REM;
    const boxH = boundsRem.height / ASSUMED_VIEWPORT_HEIGHT_REM;
    const halfW = boxW / 2;
    const halfH = boxH / 2;
    const minX = EDGE_PAD_FRAC + halfW;
    const maxX = 1 - EDGE_PAD_FRAC - halfW;
    const minY = EDGE_PAD_FRAC + halfH;
    const maxY = 1 - EDGE_PAD_FRAC - halfH;

    if (minX >= maxX || minY >= maxY) {
      continue;
    }

    const sideBoxes = placedBySide[side];
    let placedBox: Box | null = null;
    let gutterX = 0.5;
    let gutterY = 0.5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TILE; attempt += 1) {
      const ux = seededUnit(input.seedKey, index, `x:${attempt}`);
      const uy = seededUnit(input.seedKey, index, `y:${attempt}`);
      gutterX = minX + ux * (maxX - minX);
      gutterY = minY + uy * (maxY - minY);
      const candidate = boxFromCenter(gutterX, gutterY, boxW, boxH);
      // Use max of normalized gaps so both axes keep a rem-equivalent clear margin.
      const gap = Math.max(gapX, gapY);
      const collision = sideBoxes.some((existing) => boxesOverlap(candidate, existing, gap));
      if (!collision) {
        placedBox = candidate;
        break;
      }
    }

    if (!placedBox) {
      continue;
    }

    sideBoxes.push(placedBox);
    const objectX = 12 + seededUnit(input.seedKey, index, 'objx') * 76;
    const objectY = 8 + seededUnit(input.seedKey, index, 'objy') * 84;
    const placementIndex = placements.length;

    placements.push({
      placementIndex,
      tile,
      side,
      gutterX,
      gutterY,
      widthRem: Number(widthRem.toFixed(3)),
      heightRem: Number(heightRem.toFixed(3)),
      rotationDeg: Number(rotationDeg.toFixed(2)),
      opacity: 0.16 + seededUnit(input.seedKey, index, 'op') * 0.14,
      objectPosition: `${objectX.toFixed(1)}% ${objectY.toFixed(1)}%`,
    });
  }

  return placements;
}

/** Test helper: AABB overlap check in the same normalized space used for packing. */
export function scatteredMosaicPlacementsOverlap(
  a: ScatteredMosaicPlacement,
  b: ScatteredMosaicPlacement,
): boolean {
  if (a.side !== b.side) {
    return false;
  }
  const gapX = BOX_GAP_REM / ASSUMED_GUTTER_WIDTH_REM;
  const gapY = BOX_GAP_REM / ASSUMED_VIEWPORT_HEIGHT_REM;
  const gap = Math.max(gapX, gapY);
  const aBounds = rotatedBounds(a.widthRem, a.heightRem, a.rotationDeg);
  const bBounds = rotatedBounds(b.widthRem, b.heightRem, b.rotationDeg);
  const aBox = boxFromCenter(
    a.gutterX,
    a.gutterY,
    aBounds.width / ASSUMED_GUTTER_WIDTH_REM,
    aBounds.height / ASSUMED_VIEWPORT_HEIGHT_REM,
  );
  const bBox = boxFromCenter(
    b.gutterX,
    b.gutterY,
    bBounds.width / ASSUMED_GUTTER_WIDTH_REM,
    bBounds.height / ASSUMED_VIEWPORT_HEIGHT_REM,
  );
  return boxesOverlap(aBox, bBox, gap);
}
