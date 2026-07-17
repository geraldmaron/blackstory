/**
 * Curated (not random) pigment-tone assignment for the first letterform's
 * 20 filled blocks, in the same row-major reading order as `glyphBCells()`.
 *
 * Values index into `pigmentScale` (0-6). Hand-arranged so no two blocks
 * adjacent in reading order — nor stacked in the same column — repeat a
 * tone: scattered pigments, not a gradient ramp. `scatter-map.test.ts`
 * enforces this property so a future edit can't collapse it into a ramp
 * by accident.
 */
export const PIGMENT_SCATTER_MAP: readonly number[] = [
  4, 1, 6, 2, // row 0
  0, 5, // row 1
  3, 1, // row 2
  6, 4, 0, 5, // row 3
  2, 6, // row 4
  1, 3, // row 5
  5, 0, 4, 2, // row 6
];
