/**
 * Per-fact provenance display status, confidence with definitions link, "Our basis"
 * prose, and full citation list with archived copies. Composes existing fact citation rendering.
 */
import React from 'react';
import type { FactRecord } from '@repo/domain/facts';
import { FactCitationList } from '../facts/FactCitationList';
import { ConfidenceLabelWithNuance } from './ConfidenceLabelWithNuance';
import { humanizeToken, statusBannerTitle } from '../facts/format';

export type FactProvenanceDisplayProps = {
  readonly fact: Pick<
    FactRecord,
    'status' | 'confidence' | 'confidenceNote' | 'citations' | 'provenance' | 'statement'
  >;
};

export function FactProvenanceDisplay({ fact }: FactProvenanceDisplayProps) {
  const bannerTitle = statusBannerTitle(fact.status);

  return (
    <div className="ds-stack">
      {bannerTitle ? (
        <p className="ds-sans" role="status">
          <strong>{bannerTitle}</strong>
        </p>
      ) : null}
      <section aria-labelledby="fact-provenance-confidence">
        <p className="ds-section__kicker">Evidence grade</p>
        <h2 className="ds-section__title" id="fact-provenance-confidence">
          Confidence
        </h2>
        <ConfidenceLabelWithNuance
          confidence={fact.confidence}
          {...(fact.confidenceNote !== undefined ? { confidenceNote: fact.confidenceNote } : {})}
        />
        <p
          className="ds-sans"
          style={{ margin: 'var(--ds-space-2) 0 0 0', color: 'var(--ds-ink-muted)' }}
        >
          Workflow status: <span className="ds-mono">{humanizeToken(fact.status)}</span> —
          independent from the evidence grade above.
        </p>
      </section>
      <section aria-labelledby="fact-our-basis">
        <h2 className="ds-section__title" id="fact-our-basis">
          Our basis
        </h2>
        <p className="ds-sans" style={{ margin: 0 }}>
          {fact.statement}
        </p>
        <dl className="ds-sans" style={{ margin: 'var(--ds-space-3) 0 0 0' }}>
          <dt style={{ fontWeight: 600 }}>Research method</dt>
          <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>
            {humanizeToken(fact.provenance.method)}
          </dd>
          <dt style={{ fontWeight: 600 }}>Researched by</dt>
          <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{fact.provenance.researchedBy}</dd>
          {fact.provenance.reviewedBy ? (
            <>
              <dt style={{ fontWeight: 600 }}>Reviewed by</dt>
              <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{fact.provenance.reviewedBy}</dd>
            </>
          ) : null}
          {fact.provenance.reviewedAt ? (
            <>
              <dt style={{ fontWeight: 600 }}>Reviewed</dt>
              <dd style={{ margin: 0 }}>{fact.provenance.reviewedAt.split('T')[0]}</dd>
            </>
          ) : null}
        </dl>
      </section>
      <section aria-labelledby="fact-sources-heading">
        <h2 className="ds-section__title" id="fact-sources-heading">
          Sources
        </h2>
        <FactCitationList citations={fact.citations} labelledBy="fact-sources-heading" />
      </section>
    </div>
  );
}
