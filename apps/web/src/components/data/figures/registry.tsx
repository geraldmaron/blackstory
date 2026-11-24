/**
 * The figure registry (docs/ui/DESIGN.md section 9.5): every figure that loads its own rows, by
 * id. `Figure` renders one; `/data/[figure]` is its citable page; a story or a record page will
 * embed the same entry.
 *
 * The id is the figure's address (`/data/D-01`, `/data#D-01`) and never changes once published.
 * The order here is the order on `/data`.
 */
import type { FigureId } from './figure-ids';
import type { RegisteredFigure } from './figure-spec';
import { D01, D02, D03, D04, D05 } from './census';
import { D06, D07, D08, D09, D10, D11, D12, D13, D14, D15, D16 } from './indicators';

export * from './figure-spec';

export const FIGURES = {
  'D-01': D01,
  'D-02': D02,
  'D-03': D03,
  'D-04': D04,
  'D-05': D05,
  'D-06': D06,
  'D-07': D07,
  'D-08': D08,
  'D-09': D09,
  'D-10': D10,
  'D-11': D11,
  'D-12': D12,
  'D-13': D13,
  'D-14': D14,
  'D-15': D15,
  'D-16': D16,
} as const satisfies Record<FigureId, RegisteredFigure>;

export { FIGURE_IDS, figurePagePath, isFigureId, type FigureId } from './figure-ids';
