/**
 * Multi-metric storytelling panel for warehouse-ready era-indicator questions
 * (Q3 Cook redlining, Q6 drug policy). Shows grouped metrics and honest gap notes.
 */
import React from 'react';
import type { ThemeImpactPacketView } from '@repo/domain';
import { groupThemeImpactMetricSeries } from '../../lib/theme-impact/storytelling-series';
import { ThemeImpactEmptyNotice } from './ThemeImpactEmptyNotice';
import { ThemeImpactGapBannerList } from './ThemeImpactGapBanner';
import { ThemeImpactPolicyEraTimeline } from './ThemeImpactPolicyEraTimeline';
import { THEME_IMPACT_MISSING_VALUE_LABEL } from './theme-impact-copy';

export type ThemeImpactStorytellingPanelProps = {
  readonly packet: ThemeImpactPacketView;
  readonly headingId: string;
};

export function ThemeImpactStorytellingPanel({
  packet,
  headingId,
}: ThemeImpactStorytellingPanelProps) {
  const seriesGroups = groupThemeImpactMetricSeries(packet.observations);
  const timeSeriesCount = seriesGroups.filter((group) => group.isTimeSeries).length;
  const snapshotCount = seriesGroups.length - timeSeriesCount;

  return (
    <section
      className="ds-theme-impact__storytelling"
      aria-labelledby={headingId}
      data-question-id={packet.questionId}
    >
      <h2 className="ds-theme-impact__storytelling-title" id={headingId}>
        Era context and indicators
      </h2>
      <p className="ds-theme-impact__storytelling-lede">
        Question {packet.questionId} · {packet.geography.label}. Live warehouse readings when
        available; single-period snapshots and partial year coverage are labeled explicitly.
      </p>

      <ThemeImpactGapBannerList gapStates={packet.gapStates} />

      <ThemeImpactPolicyEraTimeline
        policyEras={packet.policyEras}
        headingId={`${headingId}-eras`}
      />

      <section aria-labelledby={`${headingId}-metrics`}>
        <h3 className="ds-theme-impact__subheading" id={`${headingId}-metrics`}>
          Multi-metric readings
        </h3>
        <p className="ds-theme-impact__summary">
          {seriesGroups.length === 0
            ? null
            : `${seriesGroups.length} metric group${seriesGroups.length === 1 ? '' : 's'} · ${timeSeriesCount} with multiple reference periods, ${snapshotCount} snapshot${snapshotCount === 1 ? '' : 's'}.`}
        </p>

        {seriesGroups.length === 0 ? (
          <ThemeImpactEmptyNotice kind="indicators" />
        ) : (
          <ul className="ds-theme-impact__metric-series-list">
            {seriesGroups.map((group) => (
              <li key={group.metricId} className="ds-theme-impact__metric-series-group">
                <h4 className="ds-theme-impact__metric-series-title">{group.label}</h4>
                {group.isTimeSeries ? (
                  <table className="ds-theme-impact__metric-series-table">
                    <caption className="ds-visually-hidden">
                      {group.label} across reference periods
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Period</th>
                        <th scope="col">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.points.map((point) => (
                        <tr key={`${group.metricId}:${point.referencePeriod}`}>
                          <td className="ds-mono">{point.referencePeriod}</td>
                          <td className="ds-mono ds-theme-impact__metric-value">{point.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="ds-theme-impact__metric-series-snapshot">
                    <span className="ds-mono ds-theme-impact__metric-value">
                      {group.points[0]?.value ?? THEME_IMPACT_MISSING_VALUE_LABEL}
                    </span>
                    {group.points[0]?.referencePeriod ? (
                      <span className="ds-mono ds-theme-impact__metric-period">
                        {' '}
                        · {group.points[0].referencePeriod}
                      </span>
                    ) : null}
                    <span className="ds-theme-impact__chip ds-theme-impact__chip--caution">
                      Snapshot
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {packet.derived.length > 0 ? (
        <section aria-labelledby={`${headingId}-derived`}>
          <h3 className="ds-theme-impact__subheading" id={`${headingId}-derived`}>
            Derived measurements
          </h3>
          <ul className="ds-theme-impact__metric-list">
            {packet.derived.map((row) => (
              <li key={row.id}>
                <span className="ds-theme-impact__metric-label">{row.label}</span>
                <span className="ds-mono ds-theme-impact__metric-value">{row.value}</span>
                <span className="ds-mono ds-theme-impact__metric-period"> · {row.methodId}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {packet.gapStates.length > 0 ? (
        <p className="ds-theme-impact__storytelling-gap-note">
          Gap labels remain where decennial era deltas, wealth series, or rights-gated map metrics
          are not yet in the warehouse for this geography.
        </p>
      ) : null}
    </section>
  );
}
