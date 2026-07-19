/**
 * Pure helpers for the living archive mosaic: pick which visible slot to refresh
 * and which unused pool tile to bring in. Deterministic for a given tick + seed.
 */
import { hashString } from './hash';
import type { AtmosphereTileCredit } from './tile-credits';

export type LivingTileSwap = {
  readonly slot: number;
  readonly tile: AtmosphereTileCredit;
};

/**
 * Choose one visible slot and a pool tile not currently shown.
 * Returns null when the pool cannot supply a fresh tile.
 */
export function pickLivingTileSwap(
  visible: readonly AtmosphereTileCredit[],
  pool: readonly AtmosphereTileCredit[],
  seedKey: string,
  tick: number,
): LivingTileSwap | null {
  if (visible.length === 0 || pool.length <= visible.length) return null;

  const visiblePaths = new Set(visible.map((tile) => tile.path));
  const candidates = pool.filter((tile) => !visiblePaths.has(tile.path));
  if (candidates.length === 0) return null;

  const slot = hashString(`swap-slot:${seedKey}:${tick}`) % visible.length;
  const tile = candidates[hashString(`swap-tile:${seedKey}:${tick}`) % candidates.length]!;

  return { slot, tile };
}

/** Apply a swap immutably; returns the previous tile when the slot is valid. */
export function applyLivingTileSwap(
  visible: readonly AtmosphereTileCredit[],
  swap: LivingTileSwap,
): readonly AtmosphereTileCredit[] {
  if (swap.slot < 0 || swap.slot >= visible.length) return visible;
  const next = visible.slice();
  next[swap.slot] = swap.tile;
  return next;
}
