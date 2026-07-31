/**
 * Evidence grade dot — A filled, B ringed-filled, C outline.
 *
 * The three grades differ by fill treatment as well as hue, so the grade survives a greyscale
 * render and colour is never the only signal (brand.md, design-direction-v9-atlas.md §8). An
 * ungraded record gets a hairline outline in the muted ink and the word "not graded" in its
 * label — never a fourth colour, because "nobody assessed this" is not a weaker assessment.
 */
import React from 'react';
import { cx } from '@repo/ui';
import {
  gradeDescription,
  gradeLabel,
  type EvidenceGrade,
} from '../../lib/map-experience/evidence-grade';

void React;

export type GradeDotProps = {
  readonly grade: EvidenceGrade | null;
  /** Print the letter beside the dot. Off inside a row that already shows the letter. */
  readonly withLetter?: boolean;
  readonly className?: string;
};

export function GradeDot({ grade, withLetter = false, className }: GradeDotProps) {
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
      {withLetter ? (
        <span className="ds-grade__letter" aria-hidden="true">
          {gradeLabel(grade)}
        </span>
      ) : null}
      <span className="ds-visually-hidden">{gradeDescription(grade)}</span>
    </span>
  );
}
