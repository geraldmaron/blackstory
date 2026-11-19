/**
 * The memorial wall's field: pure timing, depth and hit-testing rules, kept out of the canvas
 * component so the dignity rules they encode are testable without a browser.
 *
 * Three rules this file exists to hold:
 * - A name never vanishes. Between its moments it rests at a faint trace, the way a carved name
 *   stays on a wall in poor light. It surfaces, is held fully legible long enough to read, and
 *   rests again.
 * - Depth, not spectacle. Far names are small and faint; near names are larger and brighter. The
 *   whole wall drifts upward together, slowly enough to read a name as it passes. Every layer moves
 *   at one speed so the packed layout never slides names over each other. Nothing pulses, shakes
 *   or flashes.
 * - Reduced motion gets a composed still wall, not a frame frozen mid-fade.
 */

export type MemorialWallLayer = {
  readonly id: 'far' | 'mid' | 'near';
  /** Opacity a name rests at between its moments. Never zero. */
  readonly trace: number;
  /**
   * Opacity at the height of its moment. Every layer's peak keeps ink on the canvas at or above
   * 4.5:1 in both themes (light needs about 0.57, dark about 0.48), so each name is fully legible
   * while held; depth comes from size, how often a layer surfaces, and the resting trace.
   */
  readonly peak: number;
  /** Font size range in CSS px at desktop width; scaled down on narrow screens. */
  readonly fontSizeRange: readonly [number, number];
  /** Share of this layer's names surfaced at any one moment, on average. */
  readonly surfacedShare: number;
  /** How many names this layer asks the packer to place at desktop width. */
  readonly capacity: number;
};

export const MEMORIAL_WALL_LAYERS: readonly MemorialWallLayer[] = [
  {
    id: 'far',
    trace: 0.05,
    peak: 0.62,
    fontSizeRange: [11, 14],
    surfacedShare: 0.07,
    capacity: 120,
  },
  {
    id: 'mid',
    trace: 0.06,
    peak: 0.78,
    fontSizeRange: [16, 21],
    surfacedShare: 0.08,
    capacity: 48,
  },
  {
    id: 'near',
    trace: 0.07,
    peak: 0.95,
    fontSizeRange: [24, 32],
    surfacedShare: 0.09,
    capacity: 20,
  },
];

/** Upward drift of the whole wall, in CSS px per second. */
export const MEMORIAL_WALL_DRIFT_PX_PER_S = 3;

/** Seconds a name takes to surface, is held at full legibility, and takes to rest again. */
export const MEMORIAL_NAME_RISE_S = 2.6;
export const MEMORIAL_NAME_HOLD_MIN_S = 4.5;
export const MEMORIAL_NAME_HOLD_SPREAD_S = 3;
export const MEMORIAL_NAME_FALL_S = 3.2;

/** The one name brought forward at a time: fade in, hold, fade out, in ms. */
export const MEMORIAL_PRESENCE_IN_MS = 1800;
export const MEMORIAL_PRESENCE_HOLD_MS = 6000;
export const MEMORIAL_PRESENCE_OUT_MS = 1800;

export type MemorialWallSlot = {
  readonly layer: number;
  /** Seconds this name is held at full legibility. */
  readonly hold: number;
  /** Seconds in one full cycle (surface, hold, rest, rest...). */
  readonly period: number;
  /** Offset into the cycle, in seconds, so names do not surface together. */
  readonly phase: number;
};

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * 0 at rest, 1 while held, eased between. `u` is seconds into the slot's cycle.
 */
export function surfaceEnvelope(u: number, hold: number): number {
  if (u < 0) return 0;
  if (u < MEMORIAL_NAME_RISE_S) return smooth(u / MEMORIAL_NAME_RISE_S);
  const held = MEMORIAL_NAME_RISE_S + hold;
  if (u < held) return 1;
  if (u < held + MEMORIAL_NAME_FALL_S) return 1 - smooth((u - held) / MEMORIAL_NAME_FALL_S);
  return 0;
}

/** Builds a slot from two uniform random draws in [0, 1). */
export function memorialWallSlot(layerIndex: number, r1: number, r2: number): MemorialWallSlot {
  const layer = MEMORIAL_WALL_LAYERS[layerIndex]!;
  const hold = MEMORIAL_NAME_HOLD_MIN_S + r1 * MEMORIAL_NAME_HOLD_SPREAD_S;
  const active = MEMORIAL_NAME_RISE_S + hold + MEMORIAL_NAME_FALL_S;
  const period = active / layer.surfacedShare;
  return { layer: layerIndex, hold, period, phase: r2 * period };
}

/** Opacity of a slot `seconds` after the wall began, before any attention or intro is applied. */
export function memorialNameAlpha(slot: MemorialWallSlot, seconds: number): number {
  const layer = MEMORIAL_WALL_LAYERS[slot.layer]!;
  const u = (((seconds + slot.phase) % slot.period) + slot.period) % slot.period;
  return layer.trace + (layer.peak - layer.trace) * surfaceEnvelope(u, slot.hold);
}

/**
 * Still-wall opacity for reduced motion: every name visible at least at its trace, and a stable
 * share held fully legible, so the wall is composed rather than caught mid-fade.
 */
export function memorialNameStillAlpha(slot: MemorialWallSlot, r: number): number {
  const layer = MEMORIAL_WALL_LAYERS[slot.layer]!;
  if (r < layer.surfacedShare * 1.25) return layer.peak;
  return layer.trace + (layer.peak - layer.trace) * 0.22;
}

/**
 * How much the wall answers a resting pointer at distance `d` (px): 1 under the hand, easing to 0
 * at `radius`.
 */
export function attentionFalloff(d: number, radius: number): number {
  if (radius <= 0) return 0;
  return 1 - smooth(d / radius);
}

/** Wraps a drifting y into [-margin, span - margin). */
export function wrapDrift(y0: number, travelled: number, span: number, margin: number): number {
  if (span <= 0) return y0;
  const y = (((y0 + margin - travelled) % span) + span) % span;
  return y - margin;
}

export type MemorialWallHitTarget = {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly layer: number;
  readonly alpha: number;
};

/**
 * Which name a press at (x, y) means, as an index into `targets`, or -1. Among names whose box
 * holds the point, the nearer layer wins, then the more visible, then the closer center.
 */
export function hitTestMemorialWall(
  targets: readonly MemorialWallHitTarget[],
  x: number,
  y: number,
  slop = 6,
): number {
  let best = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i]!;
    const dx = Math.abs(x - t.x);
    const dy = Math.abs(y - t.y);
    if (dx > t.halfWidth + slop || dy > t.halfHeight + slop) continue;
    const score = t.layer * 10 + t.alpha * 5 - Math.hypot(dx, dy) / 100;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
