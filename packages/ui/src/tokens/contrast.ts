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
