/**
 * Policy-era timeline for theme-impact storytelling — flat matte markers, no
 * implied causal linkage between eras and indicator values.
 */
import React from 'react';
import type { ThemeImpactPacketView } from '@repo/domain';

export type ThemeImpactPolicyEraTimelineProps = {
  readonly policyEras: ThemeImpactPacketView['policyEras'];
  readonly headingId: string;
};

export function ThemeImpactPolicyEraTimeline({
  policyEras,
  headingId,
}: ThemeImpactPolicyEraTimelineProps) {
  if (policyEras.length === 0) return null;

  return (
    <section className="ds-theme-impact__era-timeline" aria-labelledby={headingId}>
      <h3 className="ds-theme-impact__subheading" id={headingId}>
        Policy eras (juxtaposition spine)
      </h3>
      <ol className="ds-theme-impact__era-timeline-list">
        {policyEras.map((era, index) => (
          <li key={era.id} className="ds-theme-impact__era-timeline-item">
            <span className="ds-theme-impact__era-timeline-index ds-mono" aria-hidden="true">
              {index + 1}
            </span>
            <div className="ds-theme-impact__era-timeline-body">
              <p className="ds-theme-impact__era-timeline-label">{era.label}</p>
              {era.span ? (
                <p className="ds-mono ds-theme-impact__era-timeline-span">{era.span}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="ds-theme-impact__era-timeline-note">
        Eras provide historical context beside indicators — not proof that any single policy caused
        later readings.
      </p>
    </section>
  );
}
