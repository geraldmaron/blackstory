
/**
 * Fixed Blap brand palette (the "Pinned Page" identity, brand pack v3).
 *
 * These colors are the brand's own, independent of light/dark theme tokens in
 * colors.ts, the same way a printed logo doesn't change color when the room
 * lights dim. Theme-reactive UI (text, links, borders) derives *safe*
 * applications of this palette in colors.ts; this file is the source swatches only.
 *
 * Primary site colors for main text and main backgrounds are Black Ink and
 * Archive Paper. Copper Pin remains the single loaded graphic accent (logo pin,
 * map markers) never a page background.
 */

export const brandPalette = {
  /** "Black Ink" near-black, not pure #000, softer in mass. */
  blackInk: '#0A0A0A',

  /** "Charcoal" dark-theme surface tone one step above Black Ink. */
  charcoal: '#161616',

  /** "Archive Paper" warm off-white primary light-theme page background. */
  archivePaper: '#F4EFE5',

  /** "Surface" lighter paper tone for cards and raised light-theme surfaces. */
  surface: '#FBF8F2',

  /** "Copper Pin" the mark's location-pin accent; the brand's one loaded color. */
  copperPin: '#B86B2A',

  /** "Page Sand" secondary warm accent; page-edge bands, fills, decorative tints. */
  pageSand: '#D8A178',

  /** "Stone" warm gray for secondary text on paper (4.9:1 on Archive Paper). */
  stone: '#6D675F',

  /** "Rule" hairline border tone on paper surfaces. */
  rule: '#D7D0C4',

  /**
   * Copper tuned for body text on Archive Paper (5.5:1). The text-safe
   * application of the copper accent on the light theme.
   */
  copperTextLight: '#8E4F2A',

  /** Copper tuned for dark surfaces (6.1:1 on Black Ink); dark-theme accent. */
  copperDark: '#D07A32',

  /**
   * Deep copper retained for graphic uses (logo page edges, map cluster fills).
   * Superseded for text use by `copperTextLight` see colors.ts `accent` role.
   */
  copperInk: '#7A4318',
} as const;

export type BrandPaletteKey = keyof typeof brandPalette;
