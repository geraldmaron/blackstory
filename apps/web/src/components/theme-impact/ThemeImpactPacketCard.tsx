/**
 * Theme-impact packet card — question, eras, geography, method stance, observations,
 * artifacts, gap labels, and provenance for one canonical question.
 */

import React from 'react';
import { Card } from '@repo/ui';
import type { ThemeImpactPacketView } from '@repo/domain';
import { ThemeImpactEmptyNotice } from './ThemeImpactEmptyNotice';
import { ThemeImpactGapBannerList } from './ThemeImpactGapBanner';
import {
  ThemeImpactProvenanceList,
  collectPacketProvenance,
} from './ThemeImpactProvenanceList';
import { THEME_IMPACT_METHOD_STANCE_LABEL } from './theme-impact-copy';

export type ThemeImpactPacketCardProps = {
  readonly packet: ThemeImpactPacketView;
};

const METHOD_STANCE_LABEL: Readonly<Record<ThemeImpactPacketView['methodStance'], string>> = {
  juxtaposition: THEME_IMPACT_METHOD_STANCE_LABEL,
  gated_causal_claim: 'Gated causal claim',
};

export function ThemeImpactPacketCard({ packet }: ThemeImpactPacketCardProps) {
  const provenance = collectPacketProvenance(packet);
  const provenanceHeadingId = `${packet.questionId}-provenance-heading`;
  const hasObservations = packet.observations.length > 0 || packet.derived.length > 0;

  return (
    <Card
      as="article"
      className="ds-theme-impact__packet"
      title={packet.question}
      meta={
        <p className="ds-mono ds-theme-impact__question-id">
          Question {packet.questionId}
        </p>
      }
    >
      <ThemeImpactGapBannerList gapStates={packet.gapStates} />

      <div className="ds-theme-impact__method" role="group" aria-label="Method stance">
        <p className="ds-theme-impact__method-label">
          <span className="ds-theme-impact__chip" aria-hidden="true">
            Method
          </span>
          {METHOD_STANCE_LABEL[packet.methodStance]}
        </p>
        <p className="ds-theme-impact__method-note">{packet.methodNote}</p>
      </div>

      <dl className="ds-theme-impact__meta-grid">
        <div>
          <dt>Policy eras</dt>
          <dd>
            {packet.policyEras.length > 0 ? (
              <ul className="ds-theme-impact__era-list">
                {packet.policyEras.map((era) => (
                  <li key={era.id}>
                    <span className="ds-theme-impact__era-label">{era.label}</span>
                    {era.span ? (
                      <span className="ds-mono ds-theme-impact__era-span"> ({era.span})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ds-theme-impact__meta-empty">No policy eras attached yet.</p>
            )}
          </dd>
        </div>
        <div>
          <dt>Geography</dt>
          <dd>
            {packet.geography.label}
            <span className="ds-mono ds-theme-impact__geo-unit"> · {packet.geography.unit}</span>
            {packet.geography.boundaryVersion ? (
              <span className="ds-mono ds-theme-impact__geo-version">
                {' '}
                · {packet.geography.boundaryVersion}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <section aria-labelledby={`${packet.questionId}-obs-heading`}>
        <h4 className="ds-theme-impact__subheading" id={`${packet.questionId}-obs-heading`}>
          Observations summary
        </h4>
        <p className="ds-theme-impact__summary">{packet.observationsSummary}</p>

        {packet.observations.length > 0 ? (
          <ul className="ds-theme-impact__metric-list">
            {packet.observations.map((obs) => (
              <li key={obs.id}>
                <span className="ds-theme-impact__metric-label">{obs.label}</span>
                <span className="ds-mono ds-theme-impact__metric-value">{obs.value}</span>
                {obs.referencePeriod ? (
                  <span className="ds-mono ds-theme-impact__metric-period">
                    {' '}
                    · {obs.referencePeriod}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {packet.derived.length > 0 ? (
          <>
            <h5 className="ds-theme-impact__subheading ds-theme-impact__subheading--nested">
              Derived measurements
            </h5>
            <ul className="ds-theme-impact__metric-list">
              {packet.derived.map((row) => (
                <li key={row.id}>
                  <span className="ds-theme-impact__metric-label">{row.label}</span>
                  <span className="ds-mono ds-theme-impact__metric-value">{row.value}</span>
                  <span className="ds-mono ds-theme-impact__metric-period">
                    {' '}
                    · method {row.methodId}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {!hasObservations ? <ThemeImpactEmptyNotice kind="observations" /> : null}
      </section>

      {packet.artifacts.length > 0 ? (
        <section aria-labelledby={`${packet.questionId}-artifacts-heading`}>
          <h4 className="ds-theme-impact__subheading" id={`${packet.questionId}-artifacts-heading`}>
            Artifacts
          </h4>
          <ul className="ds-theme-impact__artifact-list">
            {packet.artifacts.map((artifact) => (
              <li key={artifact.id} className="ds-theme-impact__artifact">
                <h5 className="ds-theme-impact__artifact-title">{artifact.title}</h5>
                <p className="ds-mono ds-theme-impact__artifact-meta">
                  {artifact.artifactClass.replaceAll('_', ' ')}
                  {artifact.dateLabel ? ` · ${artifact.dateLabel}` : ''}
                </p>
                <p className="ds-theme-impact__artifact-summary">{artifact.summary}</p>
                {artifact.uncertaintyLabel ? (
                  <p className="ds-theme-impact__artifact-uncertainty">
                    <span className="ds-theme-impact__chip ds-theme-impact__chip--caution">
                      Uncertainty
                    </span>
                    {artifact.uncertaintyLabel}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {provenance.length > 0 ? (
        <ThemeImpactProvenanceList
          items={provenance}
          headingId={provenanceHeadingId}
        />
      ) : (
        <ThemeImpactEmptyNotice kind="provenance" />
      )}
    </Card>
  );
}
