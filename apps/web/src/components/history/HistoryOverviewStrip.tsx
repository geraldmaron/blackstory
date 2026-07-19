/**
 * Overview strip for `/history` browse: matched record and connection counts, kind
 * composition bars, and decade density sparkline derived from the view-model overview.
 * Visual only — decade selection stays on the stepper. History-scoped classes avoid
 * coupling to home/data chart strips.
 */
import React from 'react';
import { cx } from '@repo/ui';
import type { HistoryOverview } from '../../lib/history/overview';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';

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
  const maxKindCount = overview.kindCounts.reduce((max, entry) => Math.max(max, entry.count), 0);
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
          <dt className="ds-history-overview__stat-label">Connections in view</dt>
          <dd className="ds-history-overview__stat-value">{overview.totalConnections}</dd>
        </div>
      </dl>

      {overview.kindCounts.length > 0 ? (
        <div className="ds-history-overview__kinds">
          <h3 className="ds-history-overview__section-label">Kind composition</h3>
          <ul className="ds-history-overview__kind-list">
            {overview.kindCounts.map((entry) => {
              const encoding = kindEncodingFor(entry.kind);
              const widthPercent =
                maxKindCount > 0 ? Math.max(4, Math.round((entry.count / maxKindCount) * 100)) : 0;
              const barLabel = `${encoding.label}: ${entry.count} record${
                entry.count === 1 ? '' : 's'
              }`;

              return (
                <li key={entry.kind} className="ds-history-overview__kind-row">
                  <span className="ds-history-overview__kind-label">
                    <span className="ds-history-overview__kind-label-main">
                      <span
                        className={cx(
                          'ds-legend-glyph',
                          `ds-legend-glyph--${encoding.glyph}`,
                          'ds-history-overview__kind-glyph',
                        )}
                        style={
                          encoding.glyph === 'ring'
                            ? { borderColor: encoding.shade, background: 'transparent' }
                            : { background: encoding.shade, borderColor: encoding.shade }
                        }
                        aria-hidden="true"
                      />
                      {encoding.label}
                    </span>
                    <span className="ds-history-overview__kind-count">{entry.count}</span>
                  </span>
                  <span className="ds-history-overview__kind-bar" role="img" aria-label={barLabel}>
                    <span
                      className="ds-history-overview__kind-bar-fill"
                      style={{ width: `${widthPercent}%`, background: encoding.shade }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
                  <span
                    className="ds-history-overview__density-bar-fill"
                    style={{ height: `${heightPercent}%` }}
                  />
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
