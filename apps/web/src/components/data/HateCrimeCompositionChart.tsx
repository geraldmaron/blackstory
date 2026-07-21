/**
 * Two-part horizontal composition of FBI hate crime reporting for one year — anti-Black
 * vs all other reported bias categories. Framed as reporting composition, not danger heat.
 */
import React from 'react';
import type { HateCrimeYearSummary } from '@repo/domain/statistics/public-data-summaries';
import { DataChartFrame } from './DataChartFrame';
import { formatChartCount } from './chart-utils';

export type HateCrimeCompositionChartProps = {
  readonly summary: HateCrimeYearSummary;
};

function pct(part: number, whole: number): string {
  if (whole <= 0) {
    return '—';
  }
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function HateCrimeCompositionChart({ summary }: HateCrimeCompositionChartProps) {
  const otherIncidents = Math.max(0, summary.incidents - summary.antiBlackIncidents);
  const total = summary.incidents;

  if (total <= 0) {
    return null;
  }

  const antiBlackWidth = (summary.antiBlackIncidents / total) * 100;
  const otherWidth = (otherIncidents / total) * 100;
  const participationNote =
    summary.nationalParticipatingAgenciesPct !== undefined
      ? ` That year, ${summary.nationalParticipatingAgenciesPct}% of agencies reported nationally.`
      : '';

  return (
    <DataChartFrame
      title={`What ${summary.year} reports were about`}
      caption={
        <>
          How {summary.year} hate crime reports break down by bias type (agencies that chose to
          report). Anti-Black or African American bias: {formatChartCount(summary.antiBlackIncidents)}{' '}
          ({pct(summary.antiBlackIncidents, total)}). All other reported bias categories:{' '}
          {formatChartCount(otherIncidents)} ({pct(otherIncidents, total)}).
          {participationNote}
        </>
      }
      sourceLabel={summary.source}
      sourceUrl={summary.sourceUrl}
      ariaLabel={`Hate crime reporting composition for ${summary.year}`}
      textAlternative={
        <table className="ds-data-chart__table">
          <caption>{`What ${summary.year} reports were about`}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Reports</th>
              <th scope="col">Share of reports</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Anti-Black or African American bias</th>
              <td>{formatChartCount(summary.antiBlackIncidents)}</td>
              <td>{pct(summary.antiBlackIncidents, total)}</td>
            </tr>
            <tr>
              <th scope="row">Other reported bias categories</th>
              <td>{formatChartCount(otherIncidents)}</td>
              <td>{pct(otherIncidents, total)}</td>
            </tr>
            {summary.nationalParticipatingAgenciesPct !== undefined ? (
              <tr>
                <th scope="row">Agencies participating nationally</th>
                <td colSpan={2}>{summary.nationalParticipatingAgenciesPct}%</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      }
    >
      <svg className="ds-data-chart__svg" viewBox="0 0 640 96" role="img" aria-hidden="true">
        <rect
          x={0}
          y={24}
          width={640}
          height={32}
          fill="var(--ds-surface-raised)"
          stroke="var(--ds-rule)"
          strokeWidth={1}
        />
        <rect
          x={0}
          y={24}
          width={(antiBlackWidth / 100) * 640}
          height={32}
          fill="var(--ds-accent-graphic)"
        />
        <rect
          x={(antiBlackWidth / 100) * 640}
          y={24}
          width={(otherWidth / 100) * 640}
          height={32}
          fill="var(--ds-accent-muted)"
        />
        <text className="ds-data-chart__axis-label" x={8} y={16}>
          Reports filed ({formatChartCount(total)} total)
        </text>
      </svg>
      <ul className="ds-data-chart__legend">
        <li className="ds-data-chart__legend-item">
          <span
            className="ds-data-chart__legend-swatch"
            style={{ background: 'var(--ds-accent-graphic)' }}
          />
          Anti-Black or African American bias — {formatChartCount(summary.antiBlackIncidents)} (
          {pct(summary.antiBlackIncidents, total)})
        </li>
        <li className="ds-data-chart__legend-item">
          <span
            className="ds-data-chart__legend-swatch"
            style={{ background: 'var(--ds-accent-muted)' }}
          />
          Other reported bias categories — {formatChartCount(otherIncidents)} (
          {pct(otherIncidents, total)})
        </li>
        {summary.nationalParticipatingAgenciesPct !== undefined ? (
          <li className="ds-data-chart__legend-item">
            Agencies participating nationally — {summary.nationalParticipatingAgenciesPct}%
          </li>
        ) : null}
      </ul>
    </DataChartFrame>
  );
}
