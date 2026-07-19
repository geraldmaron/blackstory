/**
 * Living memorial-name breath helpers — fade names out, in elsewhere, or
 * replace in place. Deterministic given seed + tick so tests stay stable.
 * Layer flip follows the photo mosaic: write into the incoming layer and flip
 * showB; CSS opacity transitions carry the crossfade.
 */
import type { MemorialNameEntry } from './memorial-names';
import { hashString } from './hash';

export type MemorialNameLayers = {
  readonly a: MemorialNameEntry | null;
  readonly b: MemorialNameEntry | null;
  readonly showB: boolean;
  readonly fading: boolean;
  /** Slot holds a visible name (false = empty pocket in the field). */
  readonly present: boolean;
};

export type MemorialBreathKind = 'replace' | 'evacuate' | 'arrive';

export type MemorialNameSwap = {
  readonly cellIndex: number;
  readonly kind: MemorialBreathKind;
  readonly next: MemorialNameEntry | null;
};

function entryKey(entry: MemorialNameEntry): string {
  return `${entry.name}|${entry.year}`;
}

function visibleEntry(cell: MemorialNameLayers): MemorialNameEntry | null {
  if (!cell.present) return null;
  return cell.showB ? cell.b : cell.a;
}

function unusedFromPool(
  cells: readonly MemorialNameLayers[],
  pool: readonly MemorialNameEntry[],
): MemorialNameEntry[] {
  const visible = new Set<string>();
  for (const cell of cells) {
    const entry = visibleEntry(cell);
    if (entry) visible.add(entryKey(entry));
  }
  return pool.filter((entry) => !visible.has(entryKey(entry)));
}

/**
 * Choose one breath action: replace an occupied name, evacuate to empty, or
 * arrive into a vacant slot. Deterministic for seed + tick.
 */
export function pickMemorialNameSwap(
  cells: readonly MemorialNameLayers[],
  pool: readonly MemorialNameEntry[],
  seedKey: string,
  tick: number,
): MemorialNameSwap | null {
  if (cells.length === 0 || pool.length === 0) return null;

  const occupied: number[] = [];
  const vacant: number[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i]!.present) occupied.push(i);
    else vacant.push(i);
  }

  const candidates = unusedFromPool(cells, pool);
  const roll = hashString(`memorial-breath-kind:${seedKey}:${tick}`) % 100;

  // Prefer uneven breath: evacuate / arrive often enough that the field never
  // feels like a synchronized grid of in-place swaps.
  if (roll < 28 && occupied.length > Math.max(8, Math.floor(cells.length * 0.35))) {
    const cellIndex = occupied[hashString(`memorial-evac:${seedKey}:${tick}`) % occupied.length]!;
    return { cellIndex, kind: 'evacuate', next: null };
  }

  if (roll < 58 && vacant.length > 0 && candidates.length > 0) {
    const cellIndex = vacant[hashString(`memorial-arrive-slot:${seedKey}:${tick}`) % vacant.length]!;
    const next =
      candidates[hashString(`memorial-arrive-name:${seedKey}:${tick}`) % candidates.length]!;
    return { cellIndex, kind: 'arrive', next };
  }

  if (occupied.length === 0 || candidates.length === 0) {
    if (vacant.length > 0 && candidates.length > 0) {
      const cellIndex = vacant[hashString(`memorial-arrive-slot:${seedKey}:${tick}`) % vacant.length]!;
      const next =
        candidates[hashString(`memorial-arrive-name:${seedKey}:${tick}`) % candidates.length]!;
      return { cellIndex, kind: 'arrive', next };
    }
    return null;
  }

  const cellIndex = occupied[hashString(`memorial-swap-cell:${seedKey}:${tick}`) % occupied.length]!;
  const next = candidates[hashString(`memorial-swap-name:${seedKey}:${tick}`) % candidates.length]!;
  return { cellIndex, kind: 'replace', next };
}

/**
 * How many independent breaths to start on this tick (1–3). Deterministic.
 */
export function memorialBreathBatchSize(seedKey: string, tick: number): number {
  const roll = hashString(`memorial-breath-batch:${seedKey}:${tick}`) % 100;
  if (roll < 55) return 1;
  if (roll < 88) return 2;
  return 3;
}

/** Apply one breath action; safe no-op when the swap target is invalid. */
export function applyMemorialNameSwap(
  cells: readonly MemorialNameLayers[],
  swap: MemorialNameSwap,
): MemorialNameLayers[] {
  return cells.map((cell, index) => {
    if (index !== swap.cellIndex) return cell;

    if (swap.kind === 'evacuate') {
      return { ...cell, present: false, fading: true, showB: false };
    }

    if (swap.kind === 'arrive') {
      if (!swap.next) return cell;
      return {
        a: swap.next,
        b: swap.next,
        showB: false,
        fading: true,
        present: true,
      };
    }

    // replace
    if (!swap.next || !cell.present) return cell;
    if (cell.showB) {
      return { a: swap.next, b: cell.b, showB: false, fading: true, present: true };
    }
    return { a: cell.a, b: swap.next, showB: true, fading: true, present: true };
  });
}
