/**
 * Line chart of Black population share (Black ÷ total × 100) across census decades, 1790–2020 —
 * server-rendered SVG. The line is BROKEN at the 2000 measurement-regime boundary (the
 * "Black alone" multiple-race methodology) so it never visually implies perfect comparability
 * across a definition change. Table alternative carries every value.
 */
import React, { type ReactNode } from 'react';
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import { formatSharePct, scaleLinear } from './chart-utils';

/* A half-width figure draws in a narrower box so its labels stay legible beside a sibling. */
const GEOMETRY = {
  wide: { width: 640, height: 280, margin: { top: 20, right: 20, bottom: 56, left: 80 } },
  half: { width: 480, height: 260, margin: { top: 16, right: 16, bottom: 48, left: 56 } },
} as const;

export type BlackPopulationShareChartProps = {
  readonly rows: readonly NationalPopulationTimelineRow[];
  readonly sources: readonly { readonly label: string; readonly url: string }[];
  readonly reading?: ReactNode;
  readonly figureLabel?: string;
  readonly span?: 'wide' | 'half';
  readonly id?: string;
};

function shareValue(row: NationalPopulationTimelineRow): number {
  return row.blackShareOfTotalPct ?? 0;
}

export function BlackPopulationShareChart({
  rows,
  sources,
  reading,
  figureLabel,
  span,
  id,
}: BlackPopulationShareChartProps) {
  if (rows.length === 0) {
    return null;
  }

  const {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    margin: CHART_MARGIN,
  } = GEOMETRY[span === 'half' ? 'half' : 'wide'];
  const plotW = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotH = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const shares = rows.map(shareValue);
  const domainMin = Math.max(0, Math.floor(Math.min(...shares) - 1));
  const domainMax = Math.ceil(Math.max(...shares) + 1);
  const xScale = scaleLinear(0, rows.length - 1, CHART_MARGIN.left, CHART_MARGIN.left + plotW);
  const yScale = scaleLinear(domainMin, domainMax, CHART_MARGIN.top + plotH, CHART_MARGIN.top);
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

  // Label every fourth decade and the last one, and skip a regular label that would sit on top
  // of the last: "2010 2020" at half width set as one word.
  const labelStep = span === 'half' ? 4 : 2;
  const labelEvery = (index: number) =>
    index === rows.length - 1 ||
    (index % labelStep === 0 && rows.length - 1 - index >= Math.ceil(labelStep / 2));

  return (
    <DataChartFrame
      title="Share of the U.S. that is Black, 1790 to 2020"
      {...(reading !== undefined ? { reading } : {})}
      {...(figureLabel !== undefined ? { figureLabel } : {})}
      {...(span !== undefined ? { span } : {})}
      {...(id !== undefined ? { id } : {})}
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
              className="ds-data-chart__mark"
              cx={xScale(index)}
              cy={yScale(shareValue(row))}
              r={4}
              fill="var(--ds-accent-graphic)"
              stroke="var(--ds-surface)"
              strokeWidth={2}
            >
              <title>{`${row.decade}: ${formatSharePct(row.blackPopulation, row.totalPopulation)}`}</title>
            </circle>
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
          y={CHART_MARGIN.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${CHART_MARGIN.top + plotH / 2})`}
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
