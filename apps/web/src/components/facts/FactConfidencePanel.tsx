/**
 * Evidence-grade confidence panel for a fact page.
 *
 * Renders the confidence axis independently from workflow `status` definitions come from the
 * shared domain vocabulary (`FACT_CONFIDENCE_DEFINITIONS`), not a numeric score.
 */
import React from 'react';
import { Confidence } from '@repo/ui';
import type { FactRecord } from '@repo/domain/facts';
import { confidenceDefinition, humanizeToken, mapConfidenceToUiLevel } from './format';

export type FactConfidencePanelProps = {
  readonly fact: Pick<FactRecord, 'confidence' | 'confidenceNote' | 'status'>;
};

export function FactConfidencePanel({ fact }: FactConfidencePanelProps) {
  const level = mapConfidenceToUiLevel(fact.confidence);
  const label = `${humanizeToken(fact.confidence)} evidence grade`;

  return (
    <section aria-labelledby="fact-confidence-heading">
      <p className="ds-section__kicker">Evidence grade</p>
      <h2 className="ds-section__title" id="fact-confidence-heading">
        Confidence
      </h2>
      <div style={{ marginTop: 'var(--ds-space-3)' }}>
        <Confidence level={level} label={label} />
        <p className="ds-sans" style={{ margin: 'var(--ds-space-3) 0 0 0', color: 'var(--ds-ink-muted)' }}>
          {confidenceDefinition(fact.confidence)}
        </p>
        {fact.confidenceNote ? (
          <p className="ds-sans" style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
            <strong>Nuance:</strong> {fact.confidenceNote}
          </p>
        ) : null}
        <p className="ds-sans" style={{ margin: 'var(--ds-space-2) 0 0 0', color: 'var(--ds-ink-muted)' }}>
          Workflow status (<span className="ds-mono">{fact.status}</span>) and evidence grade are independent
          axes — a contested grade can still be published when the dispute is disclosed.
        </p>
      </div>
    </section>
  );
}
