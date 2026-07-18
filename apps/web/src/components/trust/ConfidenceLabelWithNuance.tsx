/**
 * Confidence label with gotcha-preempting nuance never a bare disputed badge; always
 * links to methodology definitions for the evidence-grade vocabulary.
 */
import React from 'react';
import { Confidence } from '@blap/ui';
import { FACT_CONFIDENCE_DEFINITIONS, type FactConfidenceGrade } from '@blap/domain/facts';
import { humanizeToken, mapConfidenceToUiLevel } from '../facts/format';

export type ConfidenceLabelWithNuanceProps = {
  readonly confidence: FactConfidenceGrade;
  readonly confidenceNote?: string;
  readonly methodologyHref?: string;
};

export function ConfidenceLabelWithNuance({
  confidence,
  confidenceNote,
  methodologyHref = '/methodology#confidence',
}: ConfidenceLabelWithNuanceProps) {
  const level = mapConfidenceToUiLevel(confidence);
  const label = `${humanizeToken(confidence)} evidence grade`;

  return (
    <div>
      <Confidence level={level} label={label} />
      <p className="bp-sans" style={{ margin: 'var(--bp-space-2) 0 0 0', color: 'var(--bp-ink-muted)' }}>
        {FACT_CONFIDENCE_DEFINITIONS[confidence]}
        {' '}
        <a href={methodologyHref}>See grade definitions</a>.
      </p>
      {confidenceNote ? (
        <p className="bp-sans" style={{ margin: 'var(--bp-space-2) 0 0 0' }}>
          <strong>Nuance:</strong> {confidenceNote}
        </p>
      ) : null}
    </div>
  );
}
