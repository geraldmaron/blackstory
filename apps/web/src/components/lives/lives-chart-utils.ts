/**
 * Small shared readers for the Lives figures: whether a cell has a value to draw, and the
 * deduplicated sources behind a set of cells (the figure's footer).
 */
import type { LivesCell, LivesSourceRef } from '@repo/domain/statistics/lives';

/** A cell with an estimate to draw. Withheld, unmeasured and pending cells never draw as zero. */
export function drawnValue(cell: LivesCell): number | null {
  return (cell.state === 'published' || cell.state === 'wide_margin') && cell.estimate !== undefined
    ? cell.estimate
    : null;
}

export function sourcesOfCells(cells: readonly LivesCell[]): readonly LivesSourceRef[] {
  const seen = new Set<string>();
  const out: LivesSourceRef[] = [];
  for (const cell of cells) {
    for (const source of cell.sources ?? []) {
      const key = source.url.trim().toLowerCase() || source.label;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(source);
    }
  }
  return out;
}
