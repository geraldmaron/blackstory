/**
 * Per-fact provenance display (BB-088) — status, confidence with definitions link, "Our basis"
 * prose, and full citation list with archived copies. Composes existing fact citation rendering.
 */
import React from 'react';
import type { FactRecord } from '@black-book/domain';
import { FactCitationList } from '../facts/FactCitationList.js';
import { ConfidenceLabelWithNuance } from './ConfidenceLabelWithNuance.js';
import { humanizeToken, statusBannerTitle } from '../facts/format.js';

export type FactProvenanceDisplayProps = {
  readonly fact: Pick<
    FactRecord,
    'status' | 'confidence' | 'confidenceNote' | 'citations' | 'provenance' | 'statement'
  >;
};

export function FactProvenanceDisplay({ fact }: FactProvenanceDisplayProps) {
  const bannerTitle = statusBannerTitle(fact.status);

  return (
    <div className="bb-stack">
      {bannerTitle ? (
        <p className="bb-sans" role="status">
          <strong>{bannerTitle}</strong>
        </p>
      ) : null}
      <section aria-labelledby="fact-provenance-confidence">
        <p className="bb-section__kicker">Evidence grade</p>
        <h2 className="bb-section__title" id="fact-provenance-confidence">
          Confidence
        </h2>
        <ConfidenceLabelWithNuance
          confidence={fact.confidence}
          {...(fact.confidenceNote !== undefined ? { confidenceNote: fact.confidenceNote } : {})}
        />
        <p className="bb-sans" style={{ margin: 'var(--bb-space-2) 0 0 0', color: 'var(--bb-ink-muted)' }}>
          Workflow status: <span className="bb-mono">{humanizeToken(fact.status)}</span> — independent
          from the evidence grade above.
        </p>
      </section>
      <section aria-labelledby="fact-our-basis">
        <h2 className="bb-section__title" id="fact-our-basis">
          Our basis
        </h2>
        <p className="bb-sans" style={{ margin: 0 }}>{fact.statement}</p>
        <dl className="bb-sans" style={{ margin: 'var(--bb-space-3) 0 0 0' }}>
          <dt style={{ fontWeight: 600 }}>Research method</dt>
          <dd style={{ margin: '0 0 var(--bb-space-2) 0' }}>{humanizeToken(fact.provenance.method)}</dd>
          <dt style={{ fontWeight: 600 }}>Researched by</dt>
          <dd style={{ margin: '0 0 var(--bb-space-2) 0' }}>{fact.provenance.researchedBy}</dd>
          {fact.provenance.reviewedBy ? (
            <>
              <dt style={{ fontWeight: 600 }}>Reviewed by</dt>
              <dd style={{ margin: '0 0 var(--bb-space-2) 0' }}>{fact.provenance.reviewedBy}</dd>
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
        <h2 className="bb-section__title" id="fact-sources-heading">
          Sources
        </h2>
        <FactCitationList citations={fact.citations} labelledBy="fact-sources-heading" />
      </section>
    </div>
  );
}
