/**
 * Barrel export for the Black Book brand mark.
 */

export { BrandMark, type BrandMarkProps, type BrandMarkVariant } from './BrandMark.js';
export {
  buildGlyphLayout,
  buildMarkLayout,
  buildSocialLayout,
  type GlyphLayout,
  type MarkBlock,
  type MarkGeometryOptions,
  type MarkLayout,
} from './geometry.js';
export { GLYPH_COLUMNS, GLYPH_ROWS, glyphBCells, type GlyphCell } from './glyph.js';
export { PIGMENT_SCATTER_MAP } from './scatter-map.js';
