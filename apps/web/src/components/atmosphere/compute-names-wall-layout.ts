/**
 * Scattered typographic field for the map memorial names wall.
 * Produces uneven placements (varied scale, ink, slight rotation) rather than
 * a uniform collage grid — denser pockets and quieter gaps, seed-stable.
 */
import { hashString } from './hash';

export type NamesWallWeight = 'whisper' | 'clear' | 'accent';

export type NamesWallSlot = {
  /** Left edge as percent of the field (0–100). */
  readonly xPct: number;
  /** Top edge as percent of the field (0–100). */
  readonly yPct: number;
  /** Relative type scale (whisper < clear < accent). */
  readonly scale: number;
  /** Base ink strength before theme CSS (0–1). */
  readonly ink: number;
  /** Static tilt in degrees; brand-safe ±2° max. */
  readonly rotateDeg: number;
  readonly weight: NamesWallWeight;
  /** Whether the slot starts occupied (uneven density). */
  readonly initiallyOccupied: boolean;
};

export type NamesWallLayout = {
  /** Count of initially occupied slots (visible names at rest). */
  readonly density: number;
  readonly slots: readonly NamesWallSlot[];
};

const MIN_DENSITY = 18;
const MAX_DENSITY = 64;
/** Rough px² per visible name — larger = quieter field. */
const PX_PER_NAME = 16_500;
/** Extra empty slots so the field can breathe in/out without a full grid. */
const VACANCY_RATIO = 0.28;

function unit(seed: string): number {
  return hashString(seed) / 0xffffffff;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pickWeight(u: number): NamesWallWeight {
  if (u < 0.12) return 'accent';
  if (u < 0.38) return 'clear';
  return 'whisper';
}

function metricsForWeight(
  weight: NamesWallWeight,
  uScale: number,
  uInk: number,
): {
  readonly scale: number;
  readonly ink: number;
} {
  if (weight === 'accent') {
    return { scale: 1.15 + uScale * 0.4, ink: 0.34 + uInk * 0.14 };
  }
  if (weight === 'clear') {
    return { scale: 0.88 + uScale * 0.22, ink: 0.24 + uInk * 0.12 };
  }
  return { scale: 0.62 + uScale * 0.2, ink: 0.15 + uInk * 0.1 };
}

/**
 * Soft distance check — accents keep more space; whispers may cluster.
 */
function tooClose(
  x: number,
  y: number,
  weight: NamesWallWeight,
  placed: readonly {
    readonly xPct: number;
    readonly yPct: number;
    readonly weight: NamesWallWeight;
  }[],
): boolean {
  const minDist = weight === 'accent' ? 11 : weight === 'clear' ? 7.5 : 4.5;
  for (const other of placed) {
    const dx = x - other.xPct;
    const dy = (y - other.yPct) * 1.15;
    const dist = Math.hypot(dx, dy);
    const otherMin = other.weight === 'accent' ? 11 : other.weight === 'clear' ? 7.5 : 4.5;
    if (dist < Math.min(minDist, otherMin)) return true;
  }
  return false;
}

/**
 * Build an irregular field of name slots sized to the viewport.
 * `seedKey` keeps placements stable across remounts for the same stage.
 */
export function computeNamesWallLayout(
  widthPx: number,
  heightPx: number,
  poolSize: number,
  seedKey = 'map',
): NamesWallLayout {
  const width = Math.max(1, Math.floor(widthPx));
  const height = Math.max(1, Math.floor(heightPx));
  const pool = Math.max(12, Math.floor(poolSize));
  const area = width * height;

  const targetDensity = clamp(
    Math.round(area / PX_PER_NAME),
    MIN_DENSITY,
    Math.min(MAX_DENSITY, pool),
  );
  const slotCount = clamp(
    Math.round(targetDensity * (1 + VACANCY_RATIO)),
    targetDensity,
    Math.min(pool, Math.round(MAX_DENSITY * 1.35)),
  );

  // Bias a few soft clusters so density is uneven (not a flat scatter).
  const clusterCount = 2 + (hashString(`names-clusters:${seedKey}`) % 3);
  const clusters: { readonly x: number; readonly y: number; readonly pull: number }[] = [];
  for (let c = 0; c < clusterCount; c += 1) {
    clusters.push({
      x: 12 + unit(`names-cx:${seedKey}:${c}`) * 76,
      y: 10 + unit(`names-cy:${seedKey}:${c}`) * 78,
      pull: 0.35 + unit(`names-cp:${seedKey}:${c}`) * 0.45,
    });
  }

  const slots: NamesWallSlot[] = [];
  const occupiedBudget = targetDensity;

  for (let i = 0; i < slotCount; i += 1) {
    const weight = pickWeight(unit(`names-w:${seedKey}:${i}`));
    const { scale, ink } = metricsForWeight(
      weight,
      unit(`names-s:${seedKey}:${i}`),
      unit(`names-i:${seedKey}:${i}`),
    );
    const rotateDeg = (unit(`names-r:${seedKey}:${i}`) - 0.5) * 4; // ±2°

    let xPct = 4 + unit(`names-x:${seedKey}:${i}`) * 88;
    let yPct = 3 + unit(`names-y:${seedKey}:${i}`) * 90;

    // Pull toward a cluster for uneven density pockets.
    const cluster = clusters[hashString(`names-pick-c:${seedKey}:${i}`) % clusters.length]!;
    const toward = unit(`names-toward:${seedKey}:${i}`);
    if (toward < cluster.pull) {
      xPct = xPct * (1 - cluster.pull * 0.55) + cluster.x * (cluster.pull * 0.55);
      yPct = yPct * (1 - cluster.pull * 0.55) + cluster.y * (cluster.pull * 0.55);
    }

    // Rejection sampling for accents/clear; whisper may settle after a few tries.
    let placed = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const ax = clamp(4 + unit(`names-x:${seedKey}:${i}:${attempt}`) * 88, 2, 92);
      const ay = clamp(3 + unit(`names-y:${seedKey}:${i}:${attempt}`) * 90, 2, 94);
      const candidateX = attempt === 0 ? xPct : ax;
      const candidateY = attempt === 0 ? yPct : ay;
      if (!tooClose(candidateX, candidateY, weight, slots)) {
        xPct = candidateX;
        yPct = candidateY;
        placed = true;
        break;
      }
    }
    if (!placed) {
      xPct = clamp(xPct, 2, 92);
      yPct = clamp(yPct, 2, 94);
    }

    const initiallyOccupied = i < occupiedBudget;
    slots.push({
      xPct: Math.round(xPct * 100) / 100,
      yPct: Math.round(yPct * 100) / 100,
      scale: Math.round(scale * 100) / 100,
      ink: Math.round(ink * 1000) / 1000,
      rotateDeg: Math.round(rotateDeg * 10) / 10,
      weight,
      initiallyOccupied,
    });
  }

  return { density: occupiedBudget, slots };
}
