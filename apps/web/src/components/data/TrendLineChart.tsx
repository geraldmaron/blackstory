/**
 * Long-arc line chart for `/data` — national series with too many points for a grouped bar
 * chart to hold (a benchmark-year ratio back to 1860, a rate measured every year for two
 * decades). One polyline per named series, points that carry no value for a period are simply
 * skipped rather than drawn at zero, and only a spaced-out subset of periods gets an axis
 * label so 30-plus points do not collide into an unreadable strip. Server-rendered SVG, no
 * client chart libs, same `DataPageGroupedBarSeries` shape `GroupedBarIndicatorChart` reads.
 */
import Link from 'next/link';
import React, { type ReactNode } from 'react';
import type { DataPageGroupedBarSeries } from '@repo/domain/statistics/data-page-series';
import { DataChartFrame } from './DataChartFrame';
import { chapterHrefForTheme, formatDataPageValue, niceMax, scaleLinear } from './chart-utils';

export type TrendLineChartProps = {
  readonly series: DataPageGroupedBarSeries;
  readonly reading?: ReactNode;
  readonly figureLabel?: string;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

/* Wider than the grouped-bar geometry: a line chart needs the extra width to space out
   30-plus points, where a bar chart of the same width would cram them into slivers. */
const GEOMETRY = {
  wide: { width: 760, height: 300, margin: { top: 20, right: 16, bottom: 56, left: 64 } },
  half: { width: 480, height: 280, margin: { top: 16, right: 12, bottom: 48, left: 56 } },
} as const;

export function TrendLineChart({ series, reading, figureLabel, span, id }: TrendLineChartProps) {
  if (series.points.length === 0 || series.series.length === 0) {
    return null;
  }

  const {
    width: WIDTH,
    height: HEIGHT,
    margin: MARGIN,
  } = GEOMETRY[span === 'half' ? 'half' : 'wide'];
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const allValues = series.points.flatMap((point) =>
    series.series
      .map((def) => point.values[def.id])
      .filter((value): value is number => value !== undefined),
  );
  const maxValue = niceMax(Math.max(0, ...allValues));
  const xScale = scaleLinear(
    0,
    Math.max(1, series.points.length - 1),
    MARGIN.left,
    MARGIN.left + plotW,
  );
  const yScale = scaleLinear(0, maxValue, MARGIN.top + plotH, MARGIN.top);
  const yTicks = [0, maxValue / 2, maxValue];
  const themeLink = chapterHrefForTheme(series.themeId);

  // Roughly eight labels across the span, plus the first and last; never two within half a
  // step of the end, or the last two years collide into unreadable overlap.
  const labelStep = Math.max(1, Math.round(series.points.length / 8));
  const labelEvery = (index: number) =>
    index === series.points.length - 1 ||
    (index % labelStep === 0 && series.points.length - 1 - index >= Math.ceil(labelStep / 2));

  return (
    <DataChartFrame
      title={series.title}
      {...(reading !== undefined ? { reading } : {})}
      {...(figureLabel !== undefined ? { figureLabel } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
      caption={
        <>
          {series.caption} <span className="ds-data-chart__meta">{series.geographyLabel}</span>
          {themeLink ? (
            <>
              {' '}
              <Link className="ds-data-page__theme-link" href={themeLink}>
                Read the chapter
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
                {series.series.map((def) => {
                  const value = point.values[def.id];
                  return (
                    <td key={def.id}>
                      {value === undefined ? 'N/A' : formatDataPageValue(value, series.unit)}
                    </td>
                  );
                })}
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

        {series.series.map((def) => {
          const linePoints = series.points
            .map((point, index) => {
              const value = point.values[def.id];
              return value === undefined ? null : `${xScale(index)},${yScale(value)}`;
            })
            .filter((entry): entry is string => entry !== null)
            .join(' ');
          return (
            <polyline
              key={def.id}
              fill="none"
              stroke={def.fill}
              strokeWidth={2}
              points={linePoints}
            />
          );
        })}

        {series.points.map((point, index) => (
          <g key={point.period}>
            {series.series.map((def) => {
              const value = point.values[def.id];
              if (value === undefined) return null;
              return (
                <circle
                  key={def.id}
                  className="ds-data-chart__mark"
                  cx={xScale(index)}
                  cy={yScale(value)}
                  r={3}
                  fill={def.fill}
                  stroke="var(--ds-surface)"
                  strokeWidth={1.5}
                >
                  <title>{`${point.period} · ${def.label}: ${formatDataPageValue(value, series.unit)}`}</title>
                </circle>
              );
            })}
            {labelEvery(index) ? (
              <text
                className="ds-data-chart__axis-label"
                x={xScale(index)}
                y={HEIGHT - MARGIN.bottom + 18}
                textAnchor="middle"
              >
                {point.period}
              </text>
            ) : null}
          </g>
        ))}

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
