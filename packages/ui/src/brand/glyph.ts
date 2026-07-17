/**
 * Shared blocky "B" glyph grid for the Black Book brand mark.
 * A 5x7 construction grid, hand-drawn as blocks — not a rendered font.
 */

export const GLYPH_COLUMNS = 5;
export const GLYPH_ROWS = 7;

/** Row-major bitmap: 1 = filled block, 0 = empty. */
const GLYPH_B_ROWS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 0],
];

export type GlyphCell = {
  readonly row: number;
  readonly col: number;
};

/** Filled cells of the "B" glyph, in row-major reading order (top-to-bottom, left-to-right). */
export function glyphBCells(): readonly GlyphCell[] {
  const cells: GlyphCell[] = [];
  for (let row = 0; row < GLYPH_B_ROWS.length; row += 1) {
    const line = GLYPH_B_ROWS[row] ?? [];
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] === 1) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}
