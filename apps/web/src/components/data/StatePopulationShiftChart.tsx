/**
 * Where the Black population rose or fell between two censuses: a sorted diverging bar. State
 * names sit in a fixed column, gains run right from the zero line in ink and losses run left in a
 * lighter neutral, and every value is printed at its bar's end with its sign, so direction is
 * never carried by color alone.
 */
import React, { type CSSProperties } from 'react';
import { ChartMarks } from './ChartMarks';
import { Tip } from './chart-kit';
import { formatChartCount } from './chart-utils';
import {
  buildStateShiftBarRows,
  divergingBarDomain,
  type StateShiftBarRow,
} from './state-population-shift';
import { formatStateChangeLine, type StateChangeLike } from './population-change';

void React;

export type StatePopulationShiftChartProps = {
  readonly fromDecade: string;
  readonly toDecade: string;
  /** The ranked rows: `stateShiftRows`. */
  readonly rows: readonly StateShiftBarRow[];
  /** A state name to mark: the state of the record the figure is embedded on. */
  readonly marked?: string;
};

/** The largest gains and losses, sorted from largest gain to largest loss. */
export function stateShiftRows(
  changes: readonly StateChangeLike[],
  stateNameByFips: Readonly<Record<string, string>>,
): readonly StateShiftBarRow[] {
  return [...buildStateShiftBarRows(changes, stateNameByFips)].sort(
    (a, b) => b.blackAbsoluteChange - a.blackAbsoluteChange,
  );
}

export function formatSignedPp(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const abs = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (rounded > 0) return `+${abs} pp`;
  if (rounded < 0) return `−${abs} pp`;
  return `${abs} pp`;
}

export function signedCount(value: number): string {
  if (value > 0) return `+${formatChartCount(value)}`;
  if (value < 0) return `−${formatChartCount(Math.abs(value))}`;
  return '0';
}

export function StatePopulationShiftChart({
  fromDecade,
  toDecade,
  rows,
  marked,
}: StatePopulationShiftChartProps) {
  const { maxAbs } = divergingBarDomain(rows);

  return (
    <ChartMarks label={`Black population change by state, ${fromDecade} to ${toDecade}`}>
      <div className="ds-diverge__head" aria-hidden="true">
        <span />
        <span>Fewer Black residents</span>
        <span>More Black residents</span>
      </div>
      <ul className="ds-diverge">
        {rows.map((row, index) => {
          const gain = row.blackAbsoluteChange >= 0;
          const bar = (
            <span
              className="ds-diverge__bar"
              style={{ '--len': Math.abs(row.blackAbsoluteChange) / maxAbs } as CSSProperties}
            />
          );
          const value = (
            <span className="ds-diverge__value">{signedCount(row.blackAbsoluteChange)}</span>
          );
          return (
            <li
              key={row.stateFips}
              className="ds-diverge__row"
              data-mark=""
              {...(row.stateName === marked ? { 'data-focus': '' } : {})}
              tabIndex={index === 0 ? 0 : -1}
              aria-label={formatStateChangeLine(row, row.stateName)}
              style={{ '--tip-y': '100%' } as CSSProperties}
            >
              <span className="ds-diverge__name" aria-hidden="true">
                {row.stateName}
              </span>
              <span className="ds-diverge__side ds-diverge__side--loss" aria-hidden="true">
                {gain ? null : (
                  <>
                    {value}
                    {bar}
                  </>
                )}
              </span>
              <span className="ds-diverge__side ds-diverge__side--gain" aria-hidden="true">
                {gain ? (
                  <>
                    {bar}
                    {value}
                  </>
                ) : null}
              </span>
              <Tip
                title={row.stateName}
                rows={[
                  {
                    value: signedCount(row.blackAbsoluteChange),
                    label: 'Black residents',
                    tone: gain ? 'hi' : 'lo',
                  },
                  { value: formatSignedPp(row.shareChangePp), label: 'of state share' },
                ]}
              />
            </li>
          );
        })}
      </ul>
    </ChartMarks>
  );
}
