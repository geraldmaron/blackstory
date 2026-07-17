/**
 * Pigment scale for the Black Book brand mark and diaspora-range accent use.
 *
 * Hex values are the seven-swatch working range (Monk tones 4-10) derived
 * from the Monk Skin Tone Scale, © Google / Dr. Ellis Monk, licensed
 * CC BY 4.0: https://skintone.google — https://creativecommons.org/licenses/by/4.0/
 *
 * This is a pigment/material reference for rendering the diaspora's range in
 * the brand mark — never a classification system, and never used to depict,
 * tag, or sort an individual person. See docs/ui/brand.md for the full
 * do/never rules.
 */

export type PigmentTone = {
  readonly id: string;
  readonly mstLevel: number;
  readonly hex: string;
  readonly name: string;
};

export const MONK_SCALE_ATTRIBUTION =
  'Swatch values derived from the Monk Skin Tone Scale, © Google / Dr. Ellis Monk, CC BY 4.0 (skintone.google).' as const;

/** Ordered lightest (Monk 4) to deepest (Monk 10) — deliberately NOT used in this order in the mark. */
export const pigmentScale: readonly PigmentTone[] = [
  { id: 'pigment-1', mstLevel: 4, hex: '#EADABA', name: 'Sand' },
  { id: 'pigment-2', mstLevel: 5, hex: '#D7BD96', name: 'Wheat' },
  { id: 'pigment-3', mstLevel: 6, hex: '#A07E56', name: 'Copper' },
  { id: 'pigment-4', mstLevel: 7, hex: '#825C43', name: 'Clay' },
  { id: 'pigment-5', mstLevel: 8, hex: '#604134', name: 'Umber' },
  { id: 'pigment-6', mstLevel: 9, hex: '#3A312A', name: 'Walnut' },
  { id: 'pigment-7', mstLevel: 10, hex: '#292420', name: 'Ebony' },
] as const;

/**
 * Fixed brand ink — independent of theme tokens, so the mark's solid
 * letterform reads the same regardless of the surrounding app theme.
 */
export const brandInk = {
  solid: '#000000',
  solidInverse: '#FFFFFF',
} as const;
