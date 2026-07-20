/**
 * Compute a complete mosaic grid that fits a container without clipping cells.
 * Larger viewports get more columns/rows (smaller cells stay face-readable).
 */
export type FillMosaicLayout = {
  readonly columns: number;
  readonly rows: number;
  readonly density: number;
};

/** Keep cells large enough that faces stay readable under object-fit cover. */
const MIN_CELL_COMPACT_PX = 68;
const MIN_CELL_PX = 80;

/**
 * Choose columns × rows so every cell is fully visible inside width×height.
 * Density is always columns*rows and never exceeds poolSize.
 *
 * Prefers slightly portrait cells (~4:5) so face-forward archive tiles crop
 * less through foreheads/chins than wide landscape cells would.
 */
export function computeFillMosaicLayout(
  widthPx: number,
  heightPx: number,
  poolSize: number,
): FillMosaicLayout {
  const width = Math.max(1, Math.floor(widthPx));
  const height = Math.max(1, Math.floor(heightPx));
  const pool = Math.max(9, Math.floor(poolSize));

  // Ideal cell edge (px): denser grids as the mast grows; ultra-wide packs again.
  const target =
    width < 480 ? 76 : width < 768 ? 88 : width < 1100 ? 96 : width < 1440 ? 100 : width < 1800 ? 104 : 96;

  const minCell = width < 480 ? MIN_CELL_COMPACT_PX : MIN_CELL_PX;
  const maxColumns = Math.max(3, Math.floor(width / minCell));
  const maxRows = Math.max(3, Math.floor(height / minCell));

  let best: FillMosaicLayout & { readonly score: number } = {
    columns: 3,
    rows: 3,
    density: 9,
    score: Number.NEGATIVE_INFINITY,
  };

  for (let columns = 3; columns <= maxColumns; columns += 1) {
    for (let rows = 3; rows <= maxRows; rows += 1) {
      const density = columns * rows;
      if (density > pool) continue;

      const cellW = width / columns;
      const cellH = height / rows;
      if (cellW < minCell || cellH < minCell) continue;

      const aspect = cellW / cellH;
      // Portrait-leaning (~0.8) keeps heads in frame under object-fit: cover.
      const aspectScore = 1 - Math.min(1, Math.abs(aspect - 0.8) / 0.55);
      const densityScore = density / Math.min(pool, maxColumns * maxRows);
      const sizeScore =
        1 - Math.min(1, Math.abs(Math.min(cellW, cellH) - target) / Math.max(target, 1));
      const score = densityScore * 0.5 + aspectScore * 0.35 + sizeScore * 0.15;

      if (score > best.score) {
        best = { columns, rows, density, score };
      }
    }
  }

  return { columns: best.columns, rows: best.rows, density: best.density };
}
