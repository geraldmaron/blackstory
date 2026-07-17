/**
 * Per-fact "Common misreadings" section powered by BB-086 counterClaims[] (BB-088) — names
 * techniques in refutation copy, never people or groups.
 */
import React from 'react';
import type { FactCounterClaim } from '@black-book/domain';

export type CommonMisreadingsProps = {
  readonly counterClaims: readonly FactCounterClaim[];
  readonly labelledBy?: string;
};

export function CommonMisreadings({ counterClaims, labelledBy }: CommonMisreadingsProps) {
  if (counterClaims.length === 0) {
    return null;
  }

  return (
    <section {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}>
      <ol className="bb-sans" style={{ margin: 0, paddingLeft: 'var(--bb-space-5)' }}>
        {counterClaims.map((entry) => (
          <li key={entry.misreading} style={{ marginBottom: 'var(--bb-space-4)' }}>
            <p style={{ margin: 0 }}>
              <strong>You may see this described as:</strong> {entry.misreading}
            </p>
            <p style={{ margin: 'var(--bb-space-2) 0 0 0' }}>
              <strong>What the record shows:</strong> {entry.refutation}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
