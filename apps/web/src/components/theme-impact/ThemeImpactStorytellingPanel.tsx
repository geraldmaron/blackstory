/**
 * Multi-metric instrument panel for warehouse-ready era beats (Q3 housing,
 * Q6 drug policy, Q11 school). Metrics sit beside the continuous theme arc.
 */
import React from 'react';
import type { ThemeImpactPacketView } from '@repo/domain';
import { LinkedProse } from '../entity/LinkedProse';
import { groupThemeImpactMetricSeries } from '../../lib/theme-impact/storytelling-series';
import { ThemeImpactEmptyNotice } from './ThemeImpactEmptyNotice';
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
        Instruments for this beat
      </h2>
      {packet.observationsSummary ? (
        <LinkedProse
          className="ds-theme-impact__storytelling-lede"
          text={packet.observationsSummary}
        />
      ) : (
        <p className="ds-theme-impact__storytelling-lede">
          Beat {packet.questionId} · {packet.geography.label}. Series and snapshots stay labeled by
          period and geography.
        </p>
      )}

      <div className="ds-theme-impact__storytelling-layout">
        <ThemeImpactPolicyEraTimeline
          policyEras={packet.policyEras}
          headingId={`${headingId}-eras`}
        />

        <section aria-labelledby={`${headingId}-metrics`}>
          <h3 className="ds-theme-impact__subheading" id={`${headingId}-metrics`}>
            Readings
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
      </div>

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
          Coverage is partial for this beat. Missing years or unloaded series are labeled in the
          source packet rather than filled with inference.
        </p>
      ) : null}
    </section>
  );
}
