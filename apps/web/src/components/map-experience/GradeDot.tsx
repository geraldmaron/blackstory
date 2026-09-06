/**
 * Evidence grade dot — A filled, B ringed-filled, C outline.
 *
 * The three grades differ by fill treatment as well as hue, so the grade survives a greyscale
 * render and colour is never the only signal (brand.md, design-direction-v9-atlas.md §8). An
 * ungraded record gets a hairline outline in the muted ink and the word "not graded" in its
 * label — never a fourth colour, because "nobody assessed this" is not a weaker assessment.
 *
 * This is the mark for a grade named in the abstract: the Lens evidence-floor chips, where the
 * dot sits beside the words "A only" and the reader is choosing a threshold. A row that states
 * one record's own grade draws the three-segment meter instead (`RecordMeter`), the same mark the
 * record sheet and the record page use, so the letter always arrives with its scale.
 */
import React from 'react';
import { cx } from '@repo/ui';
import { gradeDescription, type EvidenceGrade } from '../../lib/map-experience/evidence-grade';

void React;

export type GradeDotProps = {
  readonly grade: EvidenceGrade | null;
  readonly className?: string;
};

export function GradeDot({ grade, className }: GradeDotProps) {
  return (
    <span
      className={cx(
        'ds-grade',
        grade ? `ds-grade--${grade.toLowerCase()}` : 'ds-grade--none',
        className,
      )}
      title={gradeDescription(grade)}
    >
      <i className="ds-grade__dot" aria-hidden="true" />
      <span className="ds-visually-hidden">{gradeDescription(grade)}</span>
    </span>
  );
}
