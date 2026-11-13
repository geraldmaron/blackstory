/**
 * Where the Black population rose or fell between two censuses: a sorted diverging bar. State
 * names sit in a fixed column, gains run right from the zero line in ink and losses run left in a
 * lighter neutral, and every value is printed at its bar's end with its sign, so direction is
 * never carried by color alone.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { ChartMarks } from './ChartMarks';
import { DataChartFrame } from './DataChartFrame';
import { Tip } from './chart-kit';
import { formatChartCount } from './chart-utils';
import { buildStateShiftBarRows, divergingBarDomain } from './state-population-shift';
import { formatStateChangeLine, type StateChangeLike } from './population-change';

void React;

export type StatePopulationShiftChartProps = {
  readonly fromDecade: string;
  readonly toDecade: string;
  readonly changes: readonly StateChangeLike[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
  readonly sources?: readonly { readonly label: string; readonly url: string }[];
  readonly reading?: ReactNode;
  readonly id?: string;
};

function formatSignedPp(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const abs = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (rounded > 0) return `+${abs} pp`;
  if (rounded < 0) return `−${abs} pp`;
  return `${abs} pp`;
}

function signedCount(value: number): string {
  if (value > 0) return `+${formatChartCount(value)}`;
  if (value < 0) return `−${formatChartCount(Math.abs(value))}`;
  return '0';
}

export function StatePopulationShiftChart({
  fromDecade,
  toDecade,
  changes,
  stateNameByFips,
  sources,
  reading,
  id,
}: StatePopulationShiftChartProps) {
  const rows = [...buildStateShiftBarRows(changes, stateNameByFips)].sort(
    (a, b) => b.blackAbsoluteChange - a.blackAbsoluteChange,
  );
  if (rows.length === 0) return null;

  const { maxAbs } = divergingBarDomain(rows);
  const title = `Where the Black population rose or fell, ${fromDecade} to ${toDecade}`;

  return (
    <DataChartFrame
      title={title}
      {...(sources !== undefined ? { sources } : {})}
      {...(reading !== undefined ? { reading } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={`The states and territories with the largest gains and losses in Black population between ${fromDecade} and ${toDecade}, sorted from largest gain to largest loss. Share change, in the table, is percentage points of each state’s total population.`}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">State or territory</th>
              <th scope="col">Black population change</th>
              <th scope="col">Share change (pp)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stateFips}>
                <th scope="row">{row.stateName}</th>
                <td>{formatStateChangeLine(row, row.stateName).split(': ')[1]}</td>
                <td>{formatSignedPp(row.shareChangePp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
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
    </DataChartFrame>
  );
}
