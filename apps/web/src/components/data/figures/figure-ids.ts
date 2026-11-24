/**
 * Every registry figure's id, in the order they stand on `/data`. Kept apart from the registry so
 * the sitemap can list `/data/[figure]` without loading a chart.
 */
export const FIGURE_IDS = [
  'D-01',
  'D-02',
  'D-03',
  'D-04',
  'D-05',
  'D-06',
  'D-07',
  'D-08',
  'D-09',
  'D-10',
  'D-11',
  'D-12',
  'D-13',
  'D-14',
  'D-15',
  'D-16',
] as const;

export type FigureId = (typeof FIGURE_IDS)[number];

export function isFigureId(value: string): value is FigureId {
  return (FIGURE_IDS as readonly string[]).includes(value);
}

/** A figure's own citable page. */
export function figurePagePath(id: FigureId): string {
  return `/data/${id}`;
}
