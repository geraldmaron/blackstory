/**
 * Per-fact "Common misreadings" section powered by counterClaims names
 * techniques in refutation copy, never people or groups.
 */
import React from 'react';
import type { FactCounterClaim } from '@repo/domain/facts';

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
      <ol className="ds-sans" style={{ margin: 0, paddingLeft: 'var(--ds-space-5)' }}>
        {counterClaims.map((entry) => (
          <li key={entry.misreading} style={{ marginBottom: 'var(--ds-space-4)' }}>
            <p style={{ margin: 0 }}>
              <strong>You may see this described as:</strong> {entry.misreading}
            </p>
            <p style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
              <strong>What the record shows:</strong> {entry.refutation}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
