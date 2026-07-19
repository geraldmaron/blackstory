/**
 * Diverging horizontal bar chart of state-level Black population movers for one decade pair.
 * Gains extend right, losses extend left — presence framing, no crime-heat red.
 */
import React from 'react';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_MARGIN,
  CHART_WIDTH,
  formatChartCount,
  scaleLinear,
} from './chart-utils';
import {
  buildStateShiftBarRows,
  divergingBarDomain,
  type StateShiftBarRow,
} from './state-population-shift';
import { formatStateChangeLine, type StateChangeLike } from './population-change';

void React;

const CHART_HEIGHT = 360;
const ROW_HEIGHT = 28;
const CENTER_GUTTER = 8;

export type StatePopulationShiftChartProps = {
  readonly fromDecade: string;
  readonly toDecade: string;
  readonly changes: readonly StateChangeLike[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
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

function StateShiftBars({
  rows,
  maxAbs,
  centerX,
  barMaxWidth,
}: {
  readonly rows: readonly StateShiftBarRow[];
  readonly maxAbs: number;
  readonly centerX: number;
  readonly barMaxWidth: number;
}) {
  const magnitudeScale = scaleLinear(0, maxAbs, 0, barMaxWidth);
  const top = CHART_MARGIN.top;

  return (
    <>
      <line
        className="ds-data-chart__grid-line"
        x1={centerX}
        x2={centerX}
        y1={top}
        y2={top + rows.length * ROW_HEIGHT}
      />
      {rows.map((row, index) => {
        const y = top + index * ROW_HEIGHT + ROW_HEIGHT / 2;
        const magnitude = magnitudeScale(Math.abs(row.blackAbsoluteChange));
        const isGain = row.blackAbsoluteChange >= 0;
        const barX = isGain ? centerX + CENTER_GUTTER / 2 : centerX - CENTER_GUTTER / 2 - magnitude;
        return (
          <g key={row.stateFips}>
            <text
              className="ds-data-chart__axis-label"
              x={CHART_MARGIN.left - 8}
              y={y + 4}
              textAnchor="end"
            >
              {row.stateName}
            </text>
            <rect
              x={barX}
              y={y - 10}
              width={Math.max(magnitude, 1)}
              height={20}
              fill={isGain ? 'var(--ds-accent-graphic)' : 'var(--ds-accent-muted)'}
            />
            <text
              className="ds-data-chart__axis-label"
              x={isGain ? barX + magnitude + 6 : barX - 6}
              y={y + 4}
              textAnchor={isGain ? 'start' : 'end'}
            >
              {formatChartCount(Math.abs(row.blackAbsoluteChange))}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function StatePopulationShiftChart({
  fromDecade,
  toDecade,
  changes,
  stateNameByFips,
}: StatePopulationShiftChartProps) {
  const rows = buildStateShiftBarRows(changes, stateNameByFips);
  if (rows.length === 0) {
    return null;
  }

  const { maxAbs } = divergingBarDomain(rows);
  const plotHeight = rows.length * ROW_HEIGHT;
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const centerX = CHART_MARGIN.left + plotWidth / 2;
  const barMaxWidth = plotWidth / 2 - CENTER_GUTTER;
  const viewHeight = CHART_MARGIN.top + plotHeight + CHART_MARGIN.bottom;

  return (
    <DataChartFrame
      title={`State Black population shift, ${fromDecade}→${toDecade}`}
      caption={`Largest absolute movers by Black population count between ${fromDecade} and ${toDecade}. Bars extend right for gains and left for losses; share change is percentage points of each state’s total population.`}
      ariaLabel={`Diverging bar chart of state Black population change from ${fromDecade} to ${toDecade}`}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{`State Black population shift, ${fromDecade}→${toDecade}`}</caption>
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
      <svg
        className="ds-data-chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${viewHeight}`}
        role="img"
        aria-hidden="true"
      >
        <StateShiftBars rows={rows} maxAbs={maxAbs} centerX={centerX} barMaxWidth={barMaxWidth} />
        <text
          className="ds-data-chart__axis-label"
          x={centerX - barMaxWidth / 2}
          y={viewHeight - 12}
          textAnchor="middle"
        >
          Losses
        </text>
        <text
          className="ds-data-chart__axis-label"
          x={centerX + barMaxWidth / 2}
          y={viewHeight - 12}
          textAnchor="middle"
        >
          Gains
        </text>
      </svg>
      <ul className="ds-data-chart__legend" aria-hidden="true">
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: 'var(--ds-accent-graphic)' }} />
          Black population gains
        </li>
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: 'var(--ds-accent-muted)' }} />
          Black population losses
        </li>
      </ul>
    </DataChartFrame>
  );
}
