/**
 * WCAG relative-luminance and contrast-ratio helpers for design-token validation.
 */

export type Rgb = readonly [number, number, number];

/** Parses `#RGB` or `#RRGGBB` hex into 0–255 RGB channels. */
export function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.x (0–1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * CIE L* lightness (0–100), perceptually uniform.
 *
 * Distinct from `relativeLuminance`, which is WCAG's Y and is heavily compressed near black: two
 * dark colors that look clearly different can sit a fraction of a Y point apart. Comparing map
 * plate roles needs a scale where "18 apart" means the same thing at both ends, so separation
 * thresholds use this and text contrast still uses `contrastRatio`.
 */
export function perceptualLightness(hex: string): number {
  const y = relativeLuminance(hex);
  // CIE 1976 L*, with the linear segment below the 6/29 cubed knee.
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/** Absolute CIE L* difference between two hex colors (0–100). */
export function lightnessDelta(a: string, b: string): number {
  return Math.abs(perceptualLightness(a) - perceptualLightness(b));
}

/** Contrast ratio between two hex colors (1–21). */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastLevel = 'AA' | 'AAA';

export function meetsContrast(
  foreground: string,
  background: string,
  level: ContrastLevel,
  largeText = false,
): boolean {
  const ratio = contrastRatio(foreground, background);
  if (level === 'AAA') {
    return largeText ? ratio >= 4.5 : ratio >= 7;
  }
  return largeText ? ratio >= 3 : ratio >= 4.5;
}
