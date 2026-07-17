/**
 * Confidence label with gotcha-preempting nuance (BB-088) — never a bare disputed badge; always
 * links to methodology definitions for the evidence-grade vocabulary.
 */
import React from 'react';
import { Confidence } from '@black-book/ui';
import type { FactConfidenceGrade } from '@black-book/domain';
import { FACT_CONFIDENCE_DEFINITIONS } from '@black-book/domain';
import { humanizeToken, mapConfidenceToUiLevel } from '../facts/format.js';

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
      <p className="bb-sans" style={{ margin: 'var(--bb-space-2) 0 0 0', color: 'var(--bb-ink-muted)' }}>
        {FACT_CONFIDENCE_DEFINITIONS[confidence]}
        {' '}
        <a href={methodologyHref}>See grade definitions</a>.
      </p>
      {confidenceNote ? (
        <p className="bb-sans" style={{ margin: 'var(--bb-space-2) 0 0 0' }}>
          <strong>Nuance:</strong> {confidenceNote}
        </p>
      ) : null}
    </div>
  );
}
