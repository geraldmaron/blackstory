/**
 * "Held in the Wall" reveal timing: pure, time-driven state for the memorial
 * wall's automatic opening sequence. On load the canvas is blank; after a
 * short beat names start fading in sparse and build to full density; while
 * that happens a 4-line message assembles from the same handwriting mechanic
 * and, unlike names, holds permanently once shown. Reuses the
 * prefers-reduced-motion "skip choreography, show final state" approach from
 * memorial-decade-fade.ts: reduced motion resolves everything immediately.
 */

/** Pure canvas, no names, before the sequence begins. */
export const MEMORIAL_REVEAL_BEAT_MS = 1500;

/** Names build from sparse to full density over this span after the beat. */
export const MEMORIAL_REVEAL_BUILD_MS = 12_000;

/** Absolute elapsed-ms timestamps at which each message line appears and holds. */
export const MEMORIAL_MESSAGE_LINE_TIMES_MS = [6_000, 10_000, 14_000, 18_000] as const;

export type MemorialRevealState = {
  /** 0..1 fraction of the capped on-screen subset that should be visible. */
  readonly namesDensity: number;
  /** One entry per message line; true once that line has appeared (stays true). */
  readonly messageLinesShown: readonly boolean[];
};

/**
 * Compute reveal state for a given elapsed time since the wall mounted.
 * Monotonic in `elapsedMs`: once a line is shown or density reaches a level,
 * it never reverts, so callers can poll on an interval without extra state.
 */
export function computeMemorialRevealState(
  elapsedMs: number,
  options?: { readonly reducedMotion?: boolean },
): MemorialRevealState {
  const lineCount = MEMORIAL_MESSAGE_LINE_TIMES_MS.length;

  if (options?.reducedMotion) {
    return {
      namesDensity: 1,
      messageLinesShown: Array.from({ length: lineCount }, () => true),
    };
  }

  const clampedElapsed = Math.max(0, elapsedMs);
  const sinceBeat = Math.max(0, clampedElapsed - MEMORIAL_REVEAL_BEAT_MS);
  const namesDensity =
    clampedElapsed < MEMORIAL_REVEAL_BEAT_MS ? 0 : Math.min(1, sinceBeat / MEMORIAL_REVEAL_BUILD_MS);

  const messageLinesShown = MEMORIAL_MESSAGE_LINE_TIMES_MS.map((time) => clampedElapsed >= time);

  return { namesDensity, messageLinesShown };
}

/**
 * Deterministic per-item reveal threshold in [0, 1) derived from its index
 * among `total` items, so a stable ordering of placements can be shown
 * progressively as `namesDensity` climbs without reshuffling on every tick.
 */
export function memorialNameRevealThreshold(index: number, total: number): number {
  if (total <= 1) {
    return 0;
  }
  return index / total;
}
