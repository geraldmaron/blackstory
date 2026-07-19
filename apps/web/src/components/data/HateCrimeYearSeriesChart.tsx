/**
 * Multi-year FBI hate crime reporting metrics — anti-Black share and agency participation by
 * year. Each year stands alone; incidents are never summed across years.
 */
import React from 'react';
import type { HateCrimeYearSummary } from '@repo/firebase';
import { DataChartFrame } from './DataChartFrame';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_WIDTH,
  plotHeight,
  plotWidth,
  scaleLinear,
} from './chart-utils';

void React;

export type HateCrimeYearSeriesChartProps = {
  readonly summaries: readonly HateCrimeYearSummary[];
};

type YearMetricRow = {
  readonly year: string;
  readonly antiBlackSharePct: number | null;
  readonly participationPct: number | undefined;
  readonly source: string;
  readonly sourceUrl: string;
};

function antiBlackShare(
  summary: Pick<HateCrimeYearSummary, 'incidents' | 'antiBlackIncidents'>,
): number | null {
  if (summary.incidents <= 0) {
    return null;
  }
  return summary.antiBlackIncidents / summary.incidents;
}

function buildYearMetricRows(summaries: readonly HateCrimeYearSummary[]): readonly YearMetricRow[] {
  return summaries.map((summary) => {
    const share = antiBlackShare(summary);
    return {
      year: summary.year,
      antiBlackSharePct: share === null ? null : share * 100,
      participationPct: summary.nationalParticipatingAgenciesPct,
      source: summary.source,
      sourceUrl: summary.sourceUrl,
    };
  });
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function HateCrimeYearSeriesChart({ summaries }: HateCrimeYearSeriesChartProps) {
  const rows = buildYearMetricRows(summaries);
  if (rows.length === 0) {
    return null;
  }

  const shareValues = rows
    .map((row) => row.antiBlackSharePct)
    .filter((value): value is number => value !== null);
  const participationValues = rows
    .map((row) => row.participationPct)
    .filter((value): value is number => value !== undefined);
  const maxPct = Math.max(100, ...shareValues, ...participationValues, 1);

  const groupWidth = plotWidth() / rows.length;
  const barWidth = groupWidth * 0.22;
  const pairGap = 4;
  const xScale = scaleLinear(0, rows.length, CHART_MARGIN.left, CHART_MARGIN.left + plotWidth());
  const yScale = scaleLinear(0, maxPct, CHART_MARGIN.top + plotHeight(), CHART_MARGIN.top);
  const yTicks = [0, maxPct / 2, maxPct];
  const sources = [
    {
      label: rows[0]!.source,
      url: rows[0]!.sourceUrl,
    },
  ];

  return (
    <DataChartFrame
      title="Reporting metrics by year"
      caption="Each year is shown separately — anti-Black share of reported incidents and national agency participation. Do not read year-to-year incident totals as a trend; participation coverage changed substantially over this span."
      sources={sources}
      ariaLabel="Multi-year hate crime reporting metrics chart"
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>Reporting metrics by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Anti-Black share of reported incidents</th>
              <th scope="col">Agencies participating nationally</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <th scope="row">{row.year}</th>
                <td>{row.antiBlackSharePct === null ? '—' : formatPct(row.antiBlackSharePct)}</td>
                <td>{row.participationPct === undefined ? '—' : formatPct(row.participationPct)}</td>
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
                {formatPct(tick)}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const centerX = xScale(index + 0.5);
          const shareValue = row.antiBlackSharePct ?? 0;
          const participationValue = row.participationPct ?? 0;
          const shareX = centerX - barWidth - pairGap / 2;
          const participationX = centerX + pairGap / 2;
          const shareTop = yScale(shareValue);
          const participationTop = row.participationPct !== undefined ? yScale(participationValue) : null;
          return (
            <g key={row.year}>
              {row.antiBlackSharePct !== null ? (
                <rect
                  x={shareX}
                  y={shareTop}
                  width={barWidth}
                  height={yScale(0) - shareTop}
                  fill="var(--ds-accent-graphic)"
                />
              ) : null}
              {participationTop !== null ? (
                <rect
                  x={participationX}
                  y={participationTop}
                  width={barWidth}
                  height={yScale(0) - participationTop}
                  fill="var(--ds-accent-muted)"
                />
              ) : null}
              <text
                className="ds-data-chart__axis-label"
                x={centerX}
                y={CHART_HEIGHT - CHART_MARGIN.bottom + 20}
                textAnchor="middle"
              >
                {row.year}
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
          Percent
        </text>
      </svg>
      <ul className="ds-data-chart__legend" aria-hidden="true">
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: 'var(--ds-accent-graphic)' }} />
          Anti-Black share of reported incidents
        </li>
        <li className="ds-data-chart__legend-item">
          <span className="ds-data-chart__legend-swatch" style={{ background: 'var(--ds-accent-muted)' }} />
          Agencies participating nationally
        </li>
      </ul>
    </DataChartFrame>
  );
}
