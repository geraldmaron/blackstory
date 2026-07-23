/**
 * Overview strip for `/history` browse: matched record and connection counts, plus
 * decade density sparkline. Kind composition lives on the data panel (filterable) so
 * this strip stays a compact coverage summary.
 */
import React from 'react';
import { cx } from '@repo/ui';
import type { HistoryOverview } from '../../lib/history/overview';

void React;

export type HistoryOverviewStripProps = {
  readonly overview: HistoryOverview;
  readonly activeDecade?: string;
  readonly className?: string;
};

const MAX_DENSITY_BARS = 40;

function sampleDecadeDensity(
  decades: HistoryOverview['decadeDensity'],
): HistoryOverview['decadeDensity'] {
  // Prefer non-empty decades so sparse centuries do not dominate the strip width.
  // Always cap length so the overview cannot reintroduce page-level overflow.
  const nonEmpty = decades.filter((entry) => entry.count > 0);
  const source = nonEmpty.length > 0 ? nonEmpty : decades;
  if (source.length <= MAX_DENSITY_BARS) return source;
  return source.slice(-MAX_DENSITY_BARS);
}

export function HistoryOverviewStrip({
  overview,
  activeDecade,
  className,
}: HistoryOverviewStripProps) {
  const densityBars = sampleDecadeDensity(overview.decadeDensity);
  const maxDensityCount = densityBars.reduce((max, entry) => Math.max(max, entry.count), 0);

  return (
    <section className={cx('ds-history-overview', className)} aria-label="History browse overview">
      <dl className="ds-history-overview__stats">
        <div className="ds-history-overview__stat">
          <dt className="ds-history-overview__stat-label">Records in view</dt>
          <dd className="ds-history-overview__stat-value">{overview.totalRecords}</dd>
        </div>
        <div className="ds-history-overview__stat">
          <dt className="ds-history-overview__stat-label">Published connections</dt>
          <dd className="ds-history-overview__stat-value">{overview.totalConnections}</dd>
        </div>
      </dl>

      {densityBars.length > 0 ? (
        <div className="ds-history-overview__density">
          <h3 className="ds-history-overview__section-label">Decade density</h3>
          <ul
            className="ds-history-overview__density-list"
            role="img"
            aria-label={`Decade density across ${densityBars.length} decades`}
          >
            {densityBars.map((entry) => {
              const heightPercent =
                entry.count > 0 && maxDensityCount > 0
                  ? Math.max(12, Math.round((entry.count / maxDensityCount) * 100))
                  : 4;
              const isActive = activeDecade === entry.decade;
              const barLabel = `${entry.decade}: ${entry.count} record${
                entry.count === 1 ? '' : 's'
              }`;

              return (
                <li
                  key={entry.decade}
                  className={cx(
                    'ds-history-overview__density-bar',
                    entry.count === 0 && 'ds-history-overview__density-bar--empty',
                    isActive && 'ds-history-overview__density-bar--active',
                  )}
                  aria-label={barLabel}
                >
                  <span className="ds-history-overview__density-bar-track" aria-hidden="true">
                    <span
                      className="ds-history-overview__density-bar-fill"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </span>
                  <span className="ds-history-overview__density-bar-label">{entry.decade}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
