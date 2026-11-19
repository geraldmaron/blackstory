/**
 * Two sourced, conflicting claims side by side with no winner styling, closing on a standing line
 * supplied by the caller.
 *
 * Encodes `docs/ui/story.md`'s dispute principle directly: "When credible sources disagree, both
 * values stay on the record instead of one 'winning.'" Both sides share one class and one type
 * style, and this component takes no prop that could visually favor one side over the other.
 */

import React from 'react';

void React;

export type DisputeBlockSide = {
  readonly sourceLabel: string;
  readonly claim: string;
};

export type DisputeBlockProps = {
  /** What the sources disagree about. Defaults to "The record disagrees with itself". */
  readonly label?: string;
  readonly sideA: DisputeBlockSide;
  readonly sideB: DisputeBlockSide;
  /** Closing line, e.g. "Both sources are in the archive. They stand side by side, unresolved." */
  readonly standingLine: string;
  readonly className?: string;
};

const DEFAULT_LABEL = 'The record disagrees with itself';

function DisputeSide({ sourceLabel, claim }: DisputeBlockSide) {
  return (
    <div className="ds-dispute__side">
      <p className="ds-dispute__claim">{claim}</p>
      <cite className="ds-dispute__source">{sourceLabel}</cite>
    </div>
  );
}

export function DisputeBlock({ label, sideA, sideB, standingLine, className }: DisputeBlockProps) {
  const resolvedLabel = label ?? DEFAULT_LABEL;
  return (
    <aside
      className={['ds-dispute', className].filter(Boolean).join(' ')}
      aria-label={`Contested record: ${resolvedLabel}`}
    >
      <p className="ds-dispute__label">
        <svg className="ds-dispute__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M5.5 3v10M10.5 3v10M2.5 6h6M7.5 10h6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        {resolvedLabel}
      </p>
      <div className="ds-dispute__sides">
        <DisputeSide sourceLabel={sideA.sourceLabel} claim={sideA.claim} />
        <DisputeSide sourceLabel={sideB.sourceLabel} claim={sideB.claim} />
      </div>
      <p className="ds-dispute__standing">{standingLine}</p>
    </aside>
  );
}
