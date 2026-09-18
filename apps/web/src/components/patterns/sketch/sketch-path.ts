/**
 * Deterministic hand-drawn SVG primitives shared by Methodology diagrams and the Lives scene.
 * Same cover-lock hand law: slightly wobbly edges, hatch fills, no shadows or gradients.
 */
/** Deterministic 0..1 hash of an integer seed. Same input, same output, every render. */
export function sketchHash(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

export function sketchJitter(seed: number, amp: number): number {
  return (sketchHash(seed) - 0.5) * 2 * amp;
}

/**
 * Keep generated coordinates stable across server and browser math implementations.
 * Three decimal places are well below the visible resolution of these illustrations.
 */
export function sketchCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function sketchPathNumber(value: number): string {
  return sketchCoordinate(value).toString();
}

/** A rounded rectangle redrawn as four bowed, slightly-off-true edges. */
export function sketchRect(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  amp = 2.2,
): string {
  const j = (i: number) => sketchJitter(seed + i, amp);
  const x0 = x + j(1);
  const y0 = y + j(2);
  const x1 = x + w + j(3);
  const y1 = y + j(4);
  const x2 = x + w + j(5);
  const y2 = y + h + j(6);
  const x3 = x + j(7);
  const y3 = y + h + j(8);
  const n = sketchPathNumber;
  return (
    `M ${n(x0)} ${n(y0)} ` +
    `C ${n(x0 + (x1 - x0) * 0.3)} ${n(y0 + j(9))}, ${n(x0 + (x1 - x0) * 0.7)} ${n(y0 + j(10))}, ${n(x1)} ${n(y1)} ` +
    `C ${n(x1 + j(11))} ${n(y1 + (y2 - y1) * 0.3)}, ${n(x1 + j(12))} ${n(y1 + (y2 - y1) * 0.7)}, ${n(x2)} ${n(y2)} ` +
    `C ${n(x2 - (x2 - x3) * 0.3)} ${n(y2 + j(13))}, ${n(x2 - (x2 - x3) * 0.7)} ${n(y2 + j(14))}, ${n(x3)} ${n(y3)} ` +
    `C ${n(x3 + j(15))} ${n(y3 - (y3 - y0) * 0.3)}, ${n(x3 + j(16))} ${n(y3 - (y3 - y0) * 0.7)}, ${n(x0)} ${n(y0)} Z`
  );
}

/** Diagonal hatch lines clipped to a box; density 0–1 maps to line count. */
export function sketchHatchLines(
  x: number,
  y: number,
  w: number,
  h: number,
  density: number,
  seed: number,
): readonly {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}[] {
  const clamped = Math.max(0, Math.min(1, density));
  const count = Math.round(2 + clamped * 10);
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const offset = sketchJitter(seed + i * 3, 1.2);
    const x1 = x + offset;
    const y1 = y + h * t;
    const x2 = x + w + offset;
    const y2 = y + h * t - w * 0.35;
    lines.push({
      x1: sketchCoordinate(x1),
      y1: sketchCoordinate(y1),
      x2: sketchCoordinate(x2),
      y2: sketchCoordinate(y2),
    });
  }
  return lines;
}

/** Simple house outline: body rectangle plus a pitched roof. */
export function sketchHousePath(x: number, y: number, w: number, h: number, seed: number): string {
  const body = sketchRect(x, y + h * 0.35, w, h * 0.65, seed, 1.6);
  const j = (i: number) => sketchJitter(seed + 40 + i, 1.4);
  const roof = `M ${sketchPathNumber(x + j(1))} ${sketchPathNumber(y + h * 0.4)} L ${sketchPathNumber(x + w / 2 + j(2))} ${sketchPathNumber(y + j(3))} L ${sketchPathNumber(x + w + j(4))} ${sketchPathNumber(y + h * 0.4)}`;
  return `${body} ${roof}`;
}

/** Schoolhouse: taller body with a small bell tower. */
export function sketchSchoolPath(x: number, y: number, w: number, h: number, seed: number): string {
  const body = sketchRect(x, y + h * 0.25, w, h * 0.75, seed, 1.5);
  const tower = sketchRect(x + w * 0.35, y, w * 0.3, h * 0.3, seed + 9, 1.2);
  return `${body} ${tower}`;
}

/** Era costume vehicle: wagon (pre-1920), early auto (1920–1950), sedan (1950+). */
export function sketchVehiclePath(
  x: number,
  y: number,
  w: number,
  h: number,
  decade: number,
  seed: number,
): string {
  if (decade < 1920) {
    // Wagon box + wheels as circles approximated by short arcs in path form via rects.
    return sketchRect(x, y + h * 0.25, w, h * 0.5, seed, 1.4);
  }
  if (decade < 1950) {
    const cabin = sketchRect(x + w * 0.15, y, w * 0.55, h * 0.55, seed, 1.3);
    const body = sketchRect(x, y + h * 0.4, w, h * 0.35, seed + 5, 1.3);
    return `${cabin} ${body}`;
  }
  const cabin = sketchRect(x + w * 0.2, y, w * 0.5, h * 0.55, seed, 1.2);
  const body = sketchRect(x, y + h * 0.4, w, h * 0.35, seed + 7, 1.2);
  return `${cabin} ${body}`;
}
