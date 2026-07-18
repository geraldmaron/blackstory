/**
 * Grouped bar chart of national Black population by census decade — server-rendered SVG
 * with share annotations and a screen-reader table alternative.
 */
import React from 'react';
import type { NationalPopulationByDecade } from '@blap/firebase';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  formatChartCount,
  formatSharePct,
  niceMax,
  plotHeight,
  plotWidth,
  scaleLinear,
} from './chart-utils';

export type PopulationByDecadeChartProps = {
  readonly rows: readonly NationalPopulationByDecade[];
};

export function PopulationByDecadeChart({ rows }: PopulationByDecadeChartProps) {
  if (rows.length === 0) {
    return null;
  }

  const first = rows[0]!;
  const maxBlack = niceMax(Math.max(...rows.map((row) => row.blackPopulation)));
  const xScale = scaleLinear(0, rows.length, CHART_MARGIN.left, CHART_MARGIN.left + plotWidth());
  const yScale = scaleLinear(0, maxBlack, CHART_MARGIN.top + plotHeight(), CHART_MARGIN.top);
  const groupWidth = plotWidth() / rows.length;
  const barWidth = groupWidth * 0.55;
  const yTicks = [0, maxBlack / 2, maxBlack];

  return (
    <DataChartFrame
      title="Black population by census decade"
      caption="National sum of county-level decennial counts. Share of total population shown above each bar."
      sourceLabel={first.source}
      sourceUrl={first.sourceUrl}
      ariaLabel="Bar chart of Black population by census decade"
      textAlternative={
        <table className="bp-data-chart__table">
          <caption>Black population by census decade</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Black population</th>
              <th scope="col">Total population</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">{row.decade}</th>
                <td>{formatChartCount(row.blackPopulation)}</td>
                <td>{formatChartCount(row.totalPopulation)}</td>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg
        className="bp-data-chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick}>
              <line
                className="bp-data-chart__grid-line"
                x1={CHART_MARGIN.left}
                x2={CHART_WIDTH - CHART_MARGIN.right}
                y1={y}
                y2={y}
              />
              <text className="bp-data-chart__axis-label" x={CHART_MARGIN.left - 8} y={y + 4} textAnchor="end">
                {formatChartCount(Math.round(tick))}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const centerX = xScale(index + 0.5);
          const barX = centerX - barWidth / 2;
          const barTop = yScale(row.blackPopulation);
          const barBottom = yScale(0);
          const share = formatSharePct(row.blackPopulation, row.totalPopulation);
          return (
            <g key={row.decade}>
              <rect
                x={barX}
                y={barTop}
                width={barWidth}
                height={barBottom - barTop}
                fill="var(--bp-accent-graphic)"
              />
              <text className="bp-data-chart__axis-label" x={centerX} y={barTop - 8} textAnchor="middle">
                {share}
              </text>
              <text
                className="bp-data-chart__axis-label"
                x={centerX}
                y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
                textAnchor="middle"
              >
                {row.decade}
              </text>
            </g>
          );
        })}
        <text
          className="bp-data-chart__axis-label"
          x={12}
          y={CHART_MARGIN.top + plotHeight() / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${CHART_MARGIN.top + plotHeight() / 2})`}
        >
          Black population
        </text>
      </svg>
      <ul className="bp-data-chart__legend" aria-hidden="true">
        <li className="bp-data-chart__legend-item">
          <span className="bp-data-chart__legend-swatch" style={{ background: 'var(--bp-accent-graphic)' }} />
          Black population (bars)
        </li>
        <li className="bp-data-chart__legend-item">
          <span className="bp-data-chart__legend-swatch" style={{ background: 'var(--bp-surface-raised)' }} />
          Share of total population (above each bar)
        </li>
      </ul>
    </DataChartFrame>
  );
}
