/**
 * Pure browse-mode helpers for record carousels and session lists: ordered stepping,
 * random sampling, and position labels shared by home, explore, and entity surfaces.
 */

export type BrowseMode = 'ordered' | 'random';

export function stepIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (current + delta + total) % total;
}

export type PickRandomIndexInput = {
  readonly current: number;
  readonly total: number;
  /** Test seam for deterministic random picks. Defaults to uniform index in [0, count). */
  readonly randomIndex?: (candidateCount: number) => number;
};

export function pickRandomIndex(input: PickRandomIndexInput): number {
  const { current, total } = input;
  if (total <= 1) return 0;

  const candidates = Array.from({ length: total }, (_, index) => index).filter(
    (index) => index !== current,
  );
  if (candidates.length === 0) return current;

  const pick =
    input.randomIndex !== undefined
      ? input.randomIndex(candidates.length)
      : Math.floor(Math.random() * candidates.length);
  return candidates[pick]!;
}

export function formatBrowsePosition(
  index: number,
  total: number,
  mode: BrowseMode,
): string {
  if (total <= 0) return '0 / 0';
  if (mode === 'ordered') return `${index + 1} / ${total}`;
  return `Random · ${total} record${total === 1 ? '' : 's'}`;
}

export function browseModeLabel(mode: BrowseMode): string {
  return mode === 'random' ? 'Random' : 'Ordered';
}

export type InitialBrowseIndexInput = {
  readonly total: number;
  /** Test seam; defaults to uniform index in [0, total). */
  readonly randomIndex?: (exclusiveMax: number) => number;
};

/** Pick a starting carousel index once per request (server) or mount (client fallback). */
export function initialBrowseIndex(input: InitialBrowseIndexInput | number): number {
  const total = typeof input === 'number' ? input : input.total;
  if (total <= 1) return 0;

  const pick =
    typeof input === 'number'
      ? undefined
      : input.randomIndex;
  if (pick) return pick(total);

  return Math.floor(Math.random() * total);
}
