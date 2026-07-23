/**
 * Grouped vertical bar chart for Phase 1 indicator time slices on `/data` — NHGIS
 * homeownership, HMDA denial rates, USSC sentences. Server-rendered SVG, no client libs.
 */
import Link from 'next/link';
import React from 'react';
import type { DataPageGroupedBarSeries } from '@repo/domain/statistics/data-page-series';
import { THEMES_PUBLIC_SURFACE_ENABLED } from '../../lib/theme-impact/public-surface';
import { DataChartFrame } from './DataChartFrame';
import { formatDataPageValue, niceMax, scaleLinear } from './chart-utils';

export type GroupedBarIndicatorChartProps = {
  readonly series: DataPageGroupedBarSeries;
};

const WIDTH = 720;
const HEIGHT = 300;
const MARGIN = { top: 20, right: 16, bottom: 56, left: 72 } as const;

function themeHref(themeId: string | undefined): string | undefined {
  if (!THEMES_PUBLIC_SURFACE_ENABLED || !themeId) return undefined;
  return `/themes/${themeId}`;
}

export function GroupedBarIndicatorChart({ series }: GroupedBarIndicatorChartProps) {
  if (series.points.length === 0 || series.series.length === 0) {
    return null;
  }

  const allValues = series.points.flatMap((point) =>
    series.series.map((def) => point.values[def.id] ?? 0),
  );
  const maxValue = niceMax(Math.max(...allValues));
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const groupWidth = plotW / series.points.length;
  const barGap = 4;
  const barWidth = (groupWidth - barGap * (series.series.length + 1)) / series.series.length;
  const yScale = scaleLinear(0, maxValue, MARGIN.top + plotH, MARGIN.top);
  const zeroY = yScale(0);
  const yTicks = [0, maxValue / 2, maxValue];
  const themeLink = themeHref(series.themeId);

  return (
    <DataChartFrame
      title={series.title}
      caption={
        <>
          {series.caption}{' '}
          <span className="ds-data-chart__meta">{series.geographyLabel}</span>
          {themeLink ? (
            <>
              {' '}
              <Link className="ds-data-page__theme-link" href={themeLink}>
                See this in Themes
              </Link>
            </>
          ) : null}
        </>
      }
      sources={series.sources}
      ariaLabel={`${series.title} for ${series.geographyLabel}`}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{series.title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {series.series.map((def) => (
                <th scope="col" key={def.id}>
                  {def.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.points.map((point) => (
              <tr key={point.period}>
                <th scope="row">{point.period}</th>
                {series.series.map((def) => (
                  <td key={def.id}>
                    {formatDataPageValue(point.values[def.id] ?? 0, series.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg
        className="ds-data-chart__svg ds-data-chart__svg--wide"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={tick}>
              <line
                className="ds-data-chart__grid-line"
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y}
                y2={y}
              />
              <text
                className="ds-data-chart__axis-label"
                x={MARGIN.left - 8}
                y={y + 4}
                textAnchor="end"
              >
                {formatDataPageValue(tick, series.unit)}
              </text>
            </g>
          );
        })}

        {series.points.map((point, groupIndex) => {
          const groupX = MARGIN.left + groupIndex * groupWidth;
          return (
            <g key={point.period}>
              {series.series.map((def, seriesIndex) => {
                const value = point.values[def.id] ?? 0;
                const barX = groupX + barGap + seriesIndex * (barWidth + barGap);
                const barTop = yScale(value);
                return (
                  <rect
                    key={def.id}
                    x={barX}
                    y={barTop}
                    width={barWidth}
                    height={Math.max(0, zeroY - barTop)}
                    fill={def.fill}
                  />
                );
              })}
              <text
                className="ds-data-chart__axis-label"
                x={groupX + groupWidth / 2}
                y={HEIGHT - MARGIN.bottom + 18}
                textAnchor="middle"
              >
                {point.period}
              </text>
            </g>
          );
        })}

        <text
          className="ds-data-chart__axis-label"
          x={14}
          y={MARGIN.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${MARGIN.top + plotH / 2})`}
        >
          {series.yAxisLabel}
        </text>
      </svg>
      <ul className="ds-data-chart__legend" aria-hidden="true">
        {series.series.map((def) => (
          <li key={def.id} className="ds-data-chart__legend-item">
            <span className="ds-data-chart__legend-swatch" style={{ background: def.fill }} />
            {def.label}
          </li>
        ))}
      </ul>
    </DataChartFrame>
  );
}
