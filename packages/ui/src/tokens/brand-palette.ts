
/**
 * Fixed Black Book brand palette (the "Pinned Page" identity).
 *
 * These colors are the brand's own, independent of light/dark theme tokens in
 * colors.ts, the same way a printed logo doesn't change color when the room
 * lights dim. Theme-reactive UI (text, links, borders) derives *safe*
 * applications of this palette in colors.ts; this file is the source swatches only.
 *
 * Primary site colors for main text and main backgrounds are Black Ink and
 * white canvas. Copper Pin remains the single loaded graphic accent (logo pin,
 * map markers) never a page background.
 */

export const brandPalette = {
  /** "Black Ink" near-black, not pure #000, softer in mass. */
  blackInk: '#0A0A0A',

  /**
   * White canvas primary light-theme page background.
   * Export key `archivePaper` is retained for call-site stability; value is pure white.
 */
  archivePaper: '#FFFFFF',
  /** "Copper Pin" the mark's location-pin accent; the brand's one loaded color. */
  copperPin: '#B86B2A',
  /** "Page Sand" secondary warm accent; page-edge bands, fills, dark-mode text-safe accent. */
  pageSand: '#D8A178',

  /**
   * Darkened Copper Pin used wherever an accent must carry body text on the
   * light theme's white canvas (raw Copper Pin is UI/large-scale only see
   * colors.ts `accent` role and contrast.test.ts).
 */
  copperInk: '#7A4318',
} as const;

export type BrandPaletteKey = keyof typeof brandPalette;
