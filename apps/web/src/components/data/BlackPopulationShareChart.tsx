/**
 * Line chart of Black population share (Black ÷ total × 100) across census decades —
 * copper stroke, hairline grid, server-rendered SVG with table alternative.
 */
import React from 'react';
import type { NationalPopulationByDecade } from '@repo/firebase';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  formatSharePct,
  plotHeight,
  plotWidth,
  scaleLinear,
  sourcesFromDecadeRows,
} from './chart-utils';

export type BlackPopulationShareChartProps = {
  readonly rows: readonly NationalPopulationByDecade[];
};

function shareValue(row: NationalPopulationByDecade): number {
  if (row.totalPopulation <= 0) {
    return 0;
  }
  return (row.blackPopulation / row.totalPopulation) * 100;
}

export function BlackPopulationShareChart({ rows }: BlackPopulationShareChartProps) {
  if (rows.length === 0) {
    return null;
  }

  const shares = rows.map(shareValue);
  const minShare = Math.min(...shares);
  const maxShare = Math.max(...shares);
  const domainMin = Math.max(0, Math.floor(minShare - 1));
  const domainMax = Math.ceil(maxShare + 1);
  const xScale = scaleLinear(0, rows.length - 1, CHART_MARGIN.left, CHART_MARGIN.left + plotWidth());
  const yScale = scaleLinear(domainMin, domainMax, CHART_MARGIN.top + plotHeight(), CHART_MARGIN.top);
  const yTicks = [domainMin, (domainMin + domainMax) / 2, domainMax];
  const points = rows
    .map((row, index) => `${xScale(index)},${yScale(shareValue(row))}`)
    .join(' ');
  const sources = sourcesFromDecadeRows(rows);

  return (
    <DataChartFrame
      title="Black population share by decade"
      caption="National share of total population counted as Black or African American in each decennial census."
      sources={sources}
      ariaLabel="Line chart of Black population share by census decade"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Black population share by census decade</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Share of total population</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">{row.decade}</th>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg
        className="ds-data-chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick}>
              <line
                className="ds-data-chart__grid-line"
                x1={CHART_MARGIN.left}
                x2={CHART_WIDTH - CHART_MARGIN.right}
                y1={y}
                y2={y}
              />
              <text className="ds-data-chart__axis-label" x={CHART_MARGIN.left - 8} y={y + 4} textAnchor="end">
                {tick.toFixed(1)}%
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="var(--ds-accent-graphic)"
          strokeWidth={2}
          points={points}
        />
        {rows.map((row, index) => (
          <g key={row.decade}>
            <circle
              cx={xScale(index)}
              cy={yScale(shareValue(row))}
              r={4}
              fill="var(--ds-accent-graphic)"
            />
            <text
              className="ds-data-chart__axis-label"
              x={xScale(index)}
              y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
              textAnchor="middle"
            >
              {row.decade}
            </text>
          </g>
        ))}
        <text
          className="ds-data-chart__axis-label"
          x={12}
          y={CHART_MARGIN.top + plotHeight() / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${CHART_MARGIN.top + plotHeight() / 2})`}
        >
          Share of population
        </text>
      </svg>
      <ul className="ds-data-chart__legend" aria-hidden="true">
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: 'var(--ds-accent-graphic)' }} />
          Black population share (line)
        </li>
      </ul>
    </DataChartFrame>
  );
}
