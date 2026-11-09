/**
 * The evidence grade mark: a drawn three-segment meter, the grade in words, and the source count.
 *
 * The words are the plain-word tier the record's own confidence tile uses ("Well evidenced"),
 * not the bare letter from the contract label ("Grade B · 2 sources"), so one record page does not
 * carry two vocabularies for the same thing (see `confidenceTierPhrase`). The count still comes
 * from the contract label. The meter is never the only cue: the words always sit beside it, and an
 * ungraded claim draws an empty meter under "Not graded" rather than inventing a low grade.
 */
import React from 'react';
import type { ConfidenceLevel } from '@repo/ui';
import { confidenceTierPhrase } from '../../lib/evidence/confidence-language';
import {
  EVIDENCE_METER_SEGMENTS,
  evidenceCountPhrase,
  meterLevelForTier,
} from '../../lib/map-experience/evidence-grade';
import './evidence-grade.css';

export type EvidenceGradeMarkProps = {
  readonly level: ConfidenceLevel;
  /** The contract label, e.g. "Grade B · 2 sources". */
  readonly label: string;
  readonly className?: string;
};

export function EvidenceGradeMark({ level, label, className }: EvidenceGradeMarkProps) {
  const filled = meterLevelForTier(level);
  const word = confidenceTierPhrase(level);
  const count = evidenceCountPhrase(label);
  const rootClass = ['ds-grade', `ds-grade--${level}`, className ?? '']
    .filter((part) => part.length > 0)
    .join(' ');

  return (
    <span className={rootClass} data-tier={level}>
      <span className="ds-grade__meter" aria-hidden="true">
        {Array.from({ length: EVIDENCE_METER_SEGMENTS }, (_, index) => (
          <i key={index} data-on={index < filled ? 'true' : 'false'} />
        ))}
      </span>
      <span className="ds-grade__word">{word}</span>
      {count ? <span className="ds-grade__count">{count}</span> : null}
    </span>
  );
}
