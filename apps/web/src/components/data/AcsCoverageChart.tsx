/**
 * Simple two-bar chart of ACS county vs tract coverage counts — server-rendered SVG with
 * labeled series (color is never the only signal).
 */
import React from 'react';
import type { AcsCoverageSummary } from '@repo/firebase';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  formatChartCount,
  niceMax,
  plotHeight,
  plotWidth,
  scaleLinear,
} from './chart-utils';

export type AcsCoverageChartProps = {
  readonly coverage: AcsCoverageSummary;
};

export function AcsCoverageChart({ coverage }: AcsCoverageChartProps) {
  const series = [
    {
      key: 'counties',
      label: 'Counties covered',
      value: coverage.countyCount,
      fill: 'var(--ds-accent-graphic)',
    },
    {
      key: 'tracts',
      label: 'Census tracts covered',
      value: coverage.tractCount,
      fill: 'var(--ds-accent-muted)',
    },
  ] as const;

  const maxValue = niceMax(Math.max(coverage.countyCount, coverage.tractCount));
  const groupWidth = plotWidth() / series.length;
  const barWidth = groupWidth * 0.55;
  const xScale = scaleLinear(0, series.length, CHART_MARGIN.left, CHART_MARGIN.left + plotWidth());
  const yScale = scaleLinear(0, maxValue, CHART_MARGIN.top + plotHeight(), CHART_MARGIN.top);
  const yTicks = [0, maxValue / 2, maxValue];

  return (
    <DataChartFrame
      title={`ACS ${coverage.vintage} coverage`}
      caption="Geographic coverage for 5-year American Community Survey estimates in the archive — counties and census tracts with loaded profiles."
      sourceLabel={coverage.source}
      sourceUrl={coverage.sourceUrl}
      ariaLabel="Bar chart of ACS county and tract coverage"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{`ACS ${coverage.vintage} coverage`}</caption>
          <thead>
            <tr>
              <th scope="col">Geography level</th>
              <th scope="col">Units covered</th>
            </tr>
          </thead>
          <tbody>
            {series.map((item) => (
              <tr key={item.key}>
                <th scope="row">{item.label}</th>
                <td>{formatChartCount(item.value)}</td>
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
                {formatChartCount(Math.round(tick))}
              </text>
            </g>
          );
        })}
        {series.map((item, index) => {
          const centerX = xScale(index + 0.5);
          const barX = centerX - barWidth / 2;
          const barTop = yScale(item.value);
          const barBottom = yScale(0);
          return (
            <g key={item.key}>
              <rect
                x={barX}
                y={barTop}
                width={barWidth}
                height={barBottom - barTop}
                fill={item.fill}
              />
              <text
                className="ds-data-chart__axis-label"
                x={centerX}
                y={barTop - 8}
                textAnchor="middle"
              >
                {formatChartCount(item.value)}
              </text>
              <text
                className="ds-data-chart__axis-label"
                x={centerX}
                y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
                textAnchor="middle"
              >
                {item.label}
              </text>
            </g>
          );
        })}
        <text
          className="ds-data-chart__axis-label"
          x={12}
          y={CHART_MARGIN.top + plotHeight() / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${CHART_MARGIN.top + plotHeight() / 2})`}
        >
          Units covered
        </text>
      </svg>
      <ul className="ds-data-chart__legend" aria-hidden="true">
        {series.map((item) => (
          <li key={item.key} className="ds-data-chart__legend-item">
            <span className="ds-data-chart__legend-swatch" style={{ background: item.fill }} />
            {item.label}
          </li>
        ))}
      </ul>
    </DataChartFrame>
  );
}
