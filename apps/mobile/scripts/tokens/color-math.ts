/**
 * Small, dependency-free color math used only by the brand token generator
 * (scripts/generate-brand-tokens.ts). Deliberately not gamma-correct — this
 * is a deterministic, documented approximation (linear sRGB channel mix),
 * good enough for deriving UI-role tints/shades from a fixed brand swatch
 * set and for WCAG contrast-ratio gating. Not exported to the app bundle.
 */

export type Hex = string;

export function hexToRgb(hex: Hex): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): Hex {
  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Linear channel mix of two hex colors. t=0 -> a, t=1 -> b. */
export function mix(a: Hex, b: Hex, t: number): Hex {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0..1). */
export function relativeLuminance(hex: Hex): number {
  const [r, g, b] = hexToRgb(hex).map(srgbChannelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: Hex, b: Hex): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Deterministically mixes `hex` toward `towards` in fixed small steps until
 * the result clears `minRatio` contrast against `bg`, or gives up after
 * exhausting the mix range (throws — the two source colors genuinely cannot
 * be reconciled and the caller needs a different anchor color). Used to
 * derive a contrast-safe UI-graphic variant of a brand accent that, at its
 * raw brand-guide value, does not itself clear the bar (logos/brand marks
 * are WCAG 1.4.11-exempt; a reused UI graphic role is not).
 */
export function ensureContrast(hex: Hex, bg: Hex, minRatio: number, towards: Hex): Hex {
  const STEP = 0.02;
  let candidate = hex;
  for (let t = 0; t <= 1; t += STEP) {
    candidate = mix(hex, towards, t);
    if (contrastRatio(candidate, bg) >= minRatio) {
      return candidate;
    }
  }
  throw new Error(
    `color-math.ensureContrast: could not reach ${minRatio}:1 mixing ${hex} toward ${towards} against ${bg}.`,
  );
}

/** Parse a CSS `cubic-bezier(x1, y1, x2, y2)` string into numeric control points. */
export function parseCubicBezier(css: string): [number, number, number, number] {
  const match = css.match(
    /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
  );
  if (!match) {
    throw new Error(`generate-brand-tokens: could not parse easing curve "${css}"`);
  }
  const [, x1, y1, x2, y2] = match;
  return [Number(x1), Number(y1), Number(x2), Number(y2)];
}
