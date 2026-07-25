/**
 * Theme-spine "presence + proof" dispute artifact: renders two sourced, conflicting claims
 * side by side with no winner styling, closing on a standing line supplied by the caller.
 *
 * Encodes `docs/ui/story.md`'s dispute principle directly: "When credible sources disagree,
 * both values stay on the record instead of one 'winning.' Erasure of minority evidence is a
 * bug, not a simplification." Both sides use identical typography (weight, size, color) — this
 * component takes no prop that could visually favor one side over the other.
 */

import React from 'react';

export type DisputeBlockSide = {
  readonly sourceLabel: string;
  readonly claim: string;
};

export type DisputeBlockProps = {
  /** Uppercase copper label above the two sides. Defaults to "The record disagrees with itself". */
  readonly label?: string;
  readonly sideA: DisputeBlockSide;
  readonly sideB: DisputeBlockSide;
  /** Closing line, e.g. "Both documents are in the archive. We show them side by side and let
   * the contradiction stand." */
  readonly standingLine: string;
};

const DEFAULT_LABEL = 'The record disagrees with itself';

function DisputeSide({ sourceLabel, claim }: DisputeBlockSide) {
  return (
    <p
      className="ds-sans"
      style={{
        margin: 0,
        fontStyle: 'italic',
        fontWeight: 400,
        color: 'var(--ds-ink)',
      }}
    >
      {claim} <span style={{ fontStyle: 'normal' }}>—</span>{' '}
      <cite style={{ fontStyle: 'italic' }}>{sourceLabel}</cite>
    </p>
  );
}

export function DisputeBlock({ label, sideA, sideB, standingLine }: DisputeBlockProps) {
  const resolvedLabel = label ?? DEFAULT_LABEL;

  return (
    <aside
      aria-label={`Contested record: ${resolvedLabel}`}
      style={{
        borderLeft: '2px solid var(--ds-rule)',
        paddingLeft: 'var(--ds-space-4)',
        margin: 'var(--ds-space-4) 0',
      }}
    >
      <p
        className="ds-mono"
        style={{
          margin: '0 0 var(--ds-space-3) 0',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--ds-accent)',
        }}
      >
        {resolvedLabel}
      </p>

      <div
        className="ds-stack"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-3)' }}
      >
        <DisputeSide sourceLabel={sideA.sourceLabel} claim={sideA.claim} />
        <DisputeSide sourceLabel={sideB.sourceLabel} claim={sideB.claim} />
      </div>

      <p
        className="ds-sans"
        style={{
          margin: 'var(--ds-space-3) 0 0 0',
          color: 'var(--ds-ink-muted)',
        }}
      >
        {standingLine}
      </p>
    </aside>
  );
}
