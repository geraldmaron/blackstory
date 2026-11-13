/**
 * Three entry postures for BlackStory rooms.
 *
 * Field  - no header; the room opens in the world (map, memorial plate).
 * Record - the place identity is the header (mast, evidence strip).
 * Reading - the shared `PageHeader` from @repo/ui: optional crumb, h1, optional one-line dek.
 *           No kicker, no rule, no stat tiles. Counts and release labels go in DocumentColophon.
 *
 * surface-parity.test.ts forbids a fourth posture inventing its own header vocabulary.
 */

import React from 'react';
import { cx } from '@repo/ui';

void React;

export type EntryPosture = 'field' | 'record' | 'reading';

export type DocumentColophonProps = {
  readonly facts: readonly string[];
  readonly className?: string;
};

/** Counts and release facts at the foot of a catalog, set in mono because they are data. */
export function DocumentColophon({ facts, className }: DocumentColophonProps) {
  if (facts.length === 0) return null;
  return (
    <footer className={cx('ds-entry-colophon', className)} data-posture-colophon="">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </footer>
  );
}
