/**
 * Pure layout helpers for the state Black population shift diverging bar chart on `/data`.
 */
import { rankStateMovers, type StateChangeLike } from './population-change';

export type StateShiftBarRow = {
  readonly stateFips: string;
  readonly stateName: string;
  readonly blackAbsoluteChange: number;
  readonly shareChangePp: number;
};

export function buildStateShiftBarRows(
  changes: readonly StateChangeLike[],
  nameByFips: Readonly<Record<string, string>>,
  limit = 8,
): readonly StateShiftBarRow[] {
  const { gains, losses } = rankStateMovers(changes, limit);
  return [...gains, ...losses]
    .map((row) => ({
      stateFips: row.stateFips,
      stateName: nameByFips[row.stateFips] ?? `State ${row.stateFips}`,
      blackAbsoluteChange: row.blackAbsoluteChange,
      shareChangePp: row.shareChangePp,
    }))
    .sort((a, b) => Math.abs(b.blackAbsoluteChange) - Math.abs(a.blackAbsoluteChange));
}

export function divergingBarDomain(rows: readonly StateShiftBarRow[]): {
  readonly maxAbs: number;
} {
  const maxAbs = rows.reduce(
    (max, row) => Math.max(max, Math.abs(row.blackAbsoluteChange)),
    0,
  );
  return { maxAbs: maxAbs > 0 ? maxAbs : 1 };
}
