/**
 * Line chart of Black population share (Black ÷ total × 100) across census decades, 1790–2020 —
 * server-rendered SVG. The line is BROKEN at the 2000 measurement-regime boundary (the
 * "Black alone" multiple-race methodology) so it never visually implies perfect comparability
 * across a definition change. Table alternative carries every value.
 */
import React from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  formatSharePct,
  plotHeight,
  plotWidth,
  scaleLinear,
} from './chart-utils';

export type BlackPopulationShareChartProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
};

function shareValue(row: NationalPopulationTimelineRow): number {
  return row.blackShareOfTotalPct ?? 0;
}

export function BlackPopulationShareChart({ rows, sources }: BlackPopulationShareChartProps) {
  if (rows.length === 0) {
    return null;
  }

  const shares = rows.map(shareValue);
  const domainMin = Math.max(0, Math.floor(Math.min(...shares) - 1));
  const domainMax = Math.ceil(Math.max(...shares) + 1);
  const xScale = scaleLinear(
    0,
    rows.length - 1,
    CHART_MARGIN.left,
    CHART_MARGIN.left + plotWidth(),
  );
  const yScale = scaleLinear(
    domainMin,
    domainMax,
    CHART_MARGIN.top + plotHeight(),
    CHART_MARGIN.top,
  );
  const yTicks = [domainMin, (domainMin + domainMax) / 2, domainMax];

  // Split the polyline into segments broken at every definition boundary (2000).
  const segments: string[] = [];
  let current: string[] = [];
  rows.forEach((row, index) => {
    if (row.opensDefinitionBoundary && current.length > 0) {
      segments.push(current.join(' '));
      current = [];
    }
    current.push(`${xScale(index)},${yScale(shareValue(row))}`);
  });
  if (current.length > 0) segments.push(current.join(' '));

  const labelEvery = (index: number) => index % 2 === 0 || index === rows.length - 1;

  return (
    <DataChartFrame
      title="Share of the U.S. that is Black, 1790 to 2020"
      caption={
        'Black share of the total U.S. population in each census. The line breaks at 2000, when ' +
        '“Black alone” and multiple-race answers began, a definition change, not a missing year.'
      }
      sources={sources}
      ariaLabel="Line chart of Black population share by census decade, 1790 to 2020"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Share of the U.S. that is Black, 1790 to 2020</caption>
          <thead>
            <tr>
              <th scope="col">Decade</th>
              <th scope="col">Share of total population</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decade}>
                <th scope="row">{row.decade}</th>
                <td>{formatSharePct(row.blackPopulation, row.totalPopulation)}</td>
                <td>{row.raceCategoryLabel}</td>
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
              <text
                className="ds-data-chart__axis-label"
                x={CHART_MARGIN.left - 8}
                y={y + 4}
                textAnchor="end"
              >
                {tick.toFixed(1)}%
              </text>
            </g>
          );
        })}
        {segments.map((points, index) => (
          <polyline
            key={index}
            fill="none"
            stroke="var(--ds-accent-graphic)"
            strokeWidth={2}
            points={points}
          />
        ))}
        {rows.map((row, index) => (
          <g key={row.decade}>
            <circle
              cx={xScale(index)}
              cy={yScale(shareValue(row))}
              r={3}
              fill="var(--ds-accent-graphic)"
            />
            {labelEvery(index) ? (
              <text
                className="ds-data-chart__axis-label"
                x={xScale(index)}
                y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
                textAnchor="middle"
              >
                {row.decade}
              </text>
            ) : null}
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
          <span
            className="ds-data-chart__legend-swatch"
            style={{ background: 'var(--ds-accent-graphic)' }}
          />
          Black population share (line breaks at the 2000 definition change)
        </li>
      </ul>
    </DataChartFrame>
  );
}
