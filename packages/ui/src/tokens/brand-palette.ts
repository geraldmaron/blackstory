/**
 * Fixed Black Book brand palette (the "Pinned Page" identity).
 *
 * These four colors are the brand's own — independent of light/dark theme
 * tokens in colors.ts, the same way a printed logo doesn't change color when
 * the room lights dim. Theme-reactive UI (text, links, borders) derives
 * *safe* applications of this palette in colors.ts; this file is the source
 * swatches only.
 *
 * Source: owner-supplied brand package (2026-07-17), `black-book-brand-package/`
 * — supersedes the BB-067 Monk Skin Tone Scale mark concept.
 */

export const brandPalette = {
  /** "Black Ink" — near-black, not pure #000, warmer and softer in mass. */
  blackInk: '#0A0A0A',
  /** "Archive Paper" — warm off-white canvas, not pure #FFF. */
  archivePaper: '#F4EFE5',
  /** "Copper Pin" — the mark's location-pin accent; the brand's one loaded color. */
  copperPin: '#B86B2A',
  /** "Page Sand" — secondary warm accent; page-edge bands, fills, dark-mode text-safe accent. */
  pageSand: '#D8A178',
  /**
   * Darkened Copper Pin used wherever an accent must carry body text on the
   * light theme's Archive Paper canvas (raw Copper Pin is UI/large-scale
   * only — see colors.ts `accent` role and contrast.test.ts).
   */
  copperInk: '#7A4318',
} as const;

export type BrandPaletteKey = keyof typeof brandPalette;
