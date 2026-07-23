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
};

type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

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
 * Pack unique names across the canvas with random positions and no overlaps.
 * Longer names are attempted first. Names that cannot fit are skipped.
 */
export function packMemorialNames(options: PackMemorialNamesOptions): readonly PlacedMemorialName[] {
  const cycleSeconds = options.cycleSeconds ?? 20;
  const boxGap = options.boxGap ?? 10;
  const edgePad = options.edgePad ?? 14;
  const maxAttempts = options.maxAttempts ?? 280;
  const fonts = options.fonts;
  if (fonts.length === 0 || options.canvasWidth <= 0 || options.canvasHeight <= 0) {
    return [];
  }

  const rng = createRng(options.seed);
  const unique = [...new Set(options.names)];
  const ordered = shuffle(unique, rng).sort((a, b) => b.length - a.length);
  const placedBoxes: Box[] = [];
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
      const collision = placedBoxes.some((existing) => boxesOverlap(candidate, existing, boxGap));
      if (!collision) {
        placedBox = candidate;
        break;
      }
    }
    if (!placedBox) {
      return;
    }

    placedBoxes.push(placedBox);
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
