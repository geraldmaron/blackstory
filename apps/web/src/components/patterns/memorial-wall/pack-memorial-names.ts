/**
 * Collision-aware random packer for memorial wall labels.
 * Places handwritten names without overlap; returns a subset that fits the canvas.
 */

export type MemorialMeasureFn = (
  name: string,
  fontFamily: string,
  fontSizePx: number,
) => { readonly width: number; readonly height: number };

export type PlacedMemorialName = {
  readonly name: string;
  readonly fontFamily: string;
  readonly fontSizePx: number;
  readonly rotationDeg: number;
  readonly cx: number;
  readonly cy: number;
  readonly peak: number;
  readonly delaySeconds: number;
};

export type MemorialAvoidBox = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type PackMemorialNamesOptions = {
  readonly names: readonly string[];
  readonly fonts: readonly string[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly measure: MemorialMeasureFn;
  readonly seed: number;
  readonly cycleSeconds?: number;
  readonly boxGap?: number;
  readonly edgePad?: number;
  readonly maxAttempts?: number;
  /** Permanently occupied regions (e.g. the held message) names must never land in. */
  readonly avoidBoxes?: readonly MemorialAvoidBox[] | undefined;
};

type Box = MemorialAvoidBox;

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
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
 * Coarse uniform grid over placed boxes so collision checks only scan boxes
 * in nearby cells instead of the full (growing) placed-box list. This is
 * what keeps packing near-linear instead of O(n^2): without it, packing
 * ~220 names against up to ~220 growing boxes with up to 280 placement
 * attempts each can reach ~13M brute-force overlap checks synchronously.
 */
class SpatialGrid {
  private readonly cellSize: number;
  private readonly cells = new Map<string, { box: Box; isAvoidBox: boolean }[]>();

  constructor(cellSize: number) {
    this.cellSize = Math.max(1, cellSize);
  }

  private cellKey(gx: number, gy: number): string {
    return `${gx},${gy}`;
  }

  private cellRange(box: Box, gap: number): { gx0: number; gy0: number; gx1: number; gy1: number } {
    return {
      gx0: Math.floor((box.left - gap) / this.cellSize),
      gy0: Math.floor((box.top - gap) / this.cellSize),
      gx1: Math.floor((box.right + gap) / this.cellSize),
      gy1: Math.floor((box.bottom + gap) / this.cellSize),
    };
  }

  hasCollision(candidate: Box, gap: number, avoidGap: number): boolean {
    const range = this.cellRange(candidate, Math.max(gap, avoidGap));
    for (let gx = range.gx0; gx <= range.gx1; gx += 1) {
      for (let gy = range.gy0; gy <= range.gy1; gy += 1) {
        const bucket = this.cells.get(this.cellKey(gx, gy));
        if (!bucket) {
          continue;
        }
        for (const entry of bucket) {
          if (boxesOverlap(candidate, entry.box, entry.isAvoidBox ? avoidGap : gap)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  insert(box: Box, isAvoidBox: boolean): void {
    const range = this.cellRange(box, 0);
    for (let gx = range.gx0; gx <= range.gx1; gx += 1) {
      for (let gy = range.gy0; gy <= range.gy1; gy += 1) {
        const key = this.cellKey(gx, gy);
        const bucket = this.cells.get(key);
        if (bucket) {
          bucket.push({ box, isAvoidBox });
        } else {
          this.cells.set(key, [{ box, isAvoidBox }]);
        }
      }
    }
  }
}

/**
 * Pack unique names across the canvas with random positions and no overlaps.
 * Longer names are attempted first. Names that cannot fit are skipped.
 */
export function packMemorialNames(options: PackMemorialNamesOptions): readonly PlacedMemorialName[] {
  const cycleSeconds = options.cycleSeconds ?? 20;
  const boxGap = options.boxGap ?? 10;
  const edgePad = options.edgePad ?? 14;
  // Collision checks are now O(nearby boxes) via a spatial grid rather than
  // O(all placed boxes), so a much lower attempt cap still yields comparable
  // packing quality at a fraction of the cost.
  const maxAttempts = options.maxAttempts ?? 60;
  const fonts = options.fonts;
  if (fonts.length === 0 || options.canvasWidth <= 0 || options.canvasHeight <= 0) {
    return [];
  }

  const rng = createRng(options.seed);
  const unique = [...new Set(options.names)];
  const ordered = shuffle(unique, rng).sort((a, b) => b.length - a.length);
  // Cell size tuned to roughly one typical name box so most candidates only
  // touch a small, near-constant number of neighboring cells.
  const grid = new SpatialGrid(Math.max(40, boxGap * 4));
  const avoidBoxes = options.avoidBoxes ?? [];
  for (const box of avoidBoxes) {
    grid.insert(box, true);
  }
  const placements: PlacedMemorialName[] = [];

  ordered.forEach((name, index) => {
    const fontFamily = fonts[Math.floor(rng() * fonts.length)]!;
    const fontSizePx = 14 + Math.floor(rng() * 14);
    const rotationDeg = (rng() - 0.5) * 14;
    const measured = options.measure(name, fontFamily, fontSizePx);
    const bounds = rotatedBounds(measured.width, measured.height, rotationDeg);
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;
    const minX = edgePad + halfW;
    const maxX = options.canvasWidth - edgePad - halfW;
    const minY = edgePad + halfH;
    const maxY = options.canvasHeight - edgePad - halfH;
    if (minX >= maxX || minY >= maxY) {
      return;
    }

    let placedBox: Box | null = null;
    let cx = 0;
    let cy = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      cx = minX + rng() * (maxX - minX);
      cy = minY + rng() * (maxY - minY);
      const candidate = boxFromCenter(cx, cy, bounds.width, bounds.height);
      if (!grid.hasCollision(candidate, boxGap, boxGap * 2)) {
        placedBox = candidate;
        break;
      }
    }
    if (!placedBox) {
      return;
    }

    grid.insert(placedBox, false);
    placements.push({
      name,
      fontFamily,
      fontSizePx,
      rotationDeg: Number(rotationDeg.toFixed(2)),
      cx,
      cy,
      peak: Number((0.34 + rng() * 0.22).toFixed(2)),
      delaySeconds: Number((index * (cycleSeconds / Math.max(ordered.length, 1))).toFixed(2)),
    });
  });

  return placements;
}
