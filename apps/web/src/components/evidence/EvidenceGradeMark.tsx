/**
 * The evidence grade mark: a drawn three-segment meter, the grade in words, and the source count.
 *
 * It spells the one language `@repo/public-contracts/evidence` owns ("Grade B · 2 sources"), so a
 * claim reads the same here as on the map sheet, the results rail and the app. The meter is never
 * the only cue: the words always sit beside it, and an ungraded claim draws an empty meter under
 * "Not graded" rather than inventing a low grade.
 */
import React from 'react';
import type { ConfidenceLevel } from '@repo/ui';
import {
  EVIDENCE_METER_SEGMENTS,
  evidenceCountPhrase,
  evidenceGradeWord,
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
  const word = evidenceGradeWord(label);
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
